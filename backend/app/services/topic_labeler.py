import json
import os
import re
from typing import List, Dict, Any
import logging
from app.config import settings

logger = logging.getLogger(__name__)

class TopicLabeler:
    @staticmethod
    def _generate_heuristic_summary(exemplar_texts: List[str], cluster_size: int) -> Dict[str, Any]:
        """
        Fallback heurístico rápido usando frequência léxica e extração de sentenças centrais.
        Usado quando não há chaves de API configuradas ou quando a chamada de LLM falhar.
        """
        if not exemplar_texts:
            return {
                "title": f"Tópico com {cluster_size} itens",
                "summary": "Grupo de textos correlatos sem texto exemplar disponível.",
                "keywords": ["geral", "dados"]
            }

        # Palavras de parada básicas (pt e en)
        stopwords = {
            "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "do", "da", "dos", "das",
            "em", "no", "na", "nos", "nas", "por", "para", "com", "sem", "e", "ou", "mas",
            "que", "se", "nao", "não", "como", "mais", "muito", "ja", "já", "foi", "sao", "são",
            "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "with", "by", "of",
            "is", "are", "was", "were", "it", "this", "that", "these", "those", "i", "we", "you",
            "my", "our", "me", "us", "very", "so", "but", "not", "too", "app", "aplicativo", "sistema"
        }

        # Contagem de palavras simples
        word_counts: Dict[str, int] = {}
        for text in exemplar_texts:
            tokens = re.findall(r'\b[a-zA-ZáéíóúâêîôûãõçÁÉÍÓÚÂÊÎÔÛÃÕÇ]{3,}\b', text.lower())
            for t in tokens:
                if t not in stopwords:
                    word_counts[t] = word_counts.get(t, 0) + 1

        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        keywords = [w for w, _ in sorted_words[:4]]
        if not keywords:
            keywords = ["conteúdo", "relevante"]

        first_sample = exemplar_texts[0].strip()
        first_sentence = re.split(r'[.!?\n]', first_sample)[0].strip()
        if len(first_sentence) > 120:
            first_sentence = first_sentence[:117] + "..."

        title_words = " / ".join([k.capitalize() for k in keywords[:2]])
        title = f"{title_words} ({cluster_size} docs)" if title_words else f"Tópico Geral ({cluster_size} docs)"
        summary = f"Agrupamento concentrado em {' e '.join(keywords[:3])}. Ponto central: \"{first_sentence}\"."

        return {
            "title": title[:60],
            "summary": summary[:250],
            "keywords": keywords[:5]
        }

    @classmethod
    def generate_topic_summary(
        cls,
        exemplar_texts: List[str],
        cluster_size: int,
        model: str = "gpt-4o-mini"
    ) -> Dict[str, Any]:
        """
        Envia os textos exemplares ao LLM via LiteLLM para sintetizar um rótulo e sumário objetivo.
        Fallback inteligente caso não haja API key ou ocorra erro.
        """
        has_api_key = bool(
            os.getenv("OPENAI_API_KEY") or 
            os.getenv("ANTHROPIC_API_KEY") or 
            settings.OPENAI_API_KEY or 
            settings.ANTHROPIC_API_KEY or
            "ollama" in model.lower()
        )

        if not has_api_key or model == "heuristic":
            return cls._generate_heuristic_summary(exemplar_texts, cluster_size)

        formatted_exemplars = "\n---\n".join([f"- {text[:350]}" for text in exemplar_texts[:4]])

        prompt = f"""Você é um Especialista em Inteligência de Dados e Descoberta de Tópicos.
Analise os seguintes textos exemplares representativos que pertencem a um mesmo cluster semântico (total de {cluster_size} ocorrências):

{formatted_exemplars}

Sua tarefa é gerar um resumo estruturado em JSON com o seguinte formato estrito:
{{
  "title": "Título conciso do tópico (máximo 5 palavras)",
  "summary": "Resumo executivo explicando a essência do problema ou assunto compartilhado nesses textos (1 a 2 sentenças)",
  "keywords": ["tag1", "tag2", "tag3", "tag4"]
}}
Responda APENAS o JSON válido."""

        try:
            from litellm import completion
            response = completion(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            # Limpeza caso venha envolvido em markdown ```json
            cleaned_content = re.sub(r'^```json\s*', '', content.strip(), flags=re.MULTILINE)
            cleaned_content = re.sub(r'```$', '', cleaned_content.strip(), flags=re.MULTILINE)
            parsed = json.loads(cleaned_content)
            
            return {
                "title": str(parsed.get("title", f"Cluster com {cluster_size} docs")),
                "summary": str(parsed.get("summary", "Resumo sintetizado a partir de documentos do grupo.")),
                "keywords": list(parsed.get("keywords", []))
            }
        except Exception as e:
            logger.warning(f"Erro na síntese via LLM ({e}). Recorrendo ao rotulador heurístico.")
            return cls._generate_heuristic_summary(exemplar_texts, cluster_size)

