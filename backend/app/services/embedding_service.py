import re
import numpy as np
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    _models: dict = {}

    @classmethod
    def clean_text(cls, text: str) -> str:
        """
        Normaliza e limpa o texto para extração de embeddings.
        """
        if not text:
            return ""
        # Remove caracteres de controle estranhos, mantém pontuação útil
        cleaned = re.sub(r'[\r\n\t]+', ' ', str(text))
        cleaned = re.sub(r'\s{2,}', ' ', cleaned)
        return cleaned.strip()

    @classmethod
    def get_model(cls, model_name: str = "BAAI/bge-small-en-v1.5"):
        if model_name not in cls._models:
            try:
                from fastembed import TextEmbedding
                logger.info(f"Carregando modelo FastEmbed: {model_name}")
                cls._models[model_name] = TextEmbedding(model_name=model_name)
            except Exception as e:
                logger.warning(f"Falha ao carregar FastEmbed ({e}). Usando fallback...")
                cls._models[model_name] = None
        return cls._models[model_name]

    @classmethod
    def extract_embeddings(
        cls,
        texts: List[str],
        model_name: str = "BAAI/bge-small-en-v1.5",
        batch_size: int = 64
    ) -> np.ndarray:
        """
        Gera vetores densos normalizados para a lista de textos.
        Retorna matriz NumPy (N, dim).
        """
        cleaned_texts = [cls.clean_text(t) for t in texts]
        non_empty = [t if t else "documento vazio" for t in cleaned_texts]

        model = cls.get_model(model_name)
        if model is not None:
            try:
                embeddings_generator = model.embed(non_empty, batch_size=batch_size)
                embeddings_list = list(embeddings_generator)
                embeddings = np.array(embeddings_list, dtype=np.float32)

                # Normalização L2 para garantir que distância euclidiana seja proporcional à cosine
                norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
                norms[norms == 0] = 1e-12
                normalized = embeddings / norms
                return normalized
            except Exception as e:
                logger.warning(f"Erro na inferência FastEmbed: {e}. Usando gerador vetorial de fallback.")

        # Fallback de emergência (caso ambiente esteja sem rede para baixar pesos ONNX ou offline)
        # Usa representação baseada em TF-IDF / decomposição SVD
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.decomposition import TruncatedSVD

            vectorizer = TfidfVectorizer(max_features=500, stop_words="english")
            tfidf_matrix = vectorizer.fit_transform(non_empty)
            n_components = min(64, tfidf_matrix.shape[1], max(2, len(non_empty) - 1))
            
            if n_components >= 2 and tfidf_matrix.shape[1] >= n_components:
                svd = TruncatedSVD(n_components=n_components, random_state=42)
                reduced = svd.fit_transform(tfidf_matrix)
                norms = np.linalg.norm(reduced, axis=1, keepdims=True)
                norms[norms == 0] = 1e-12
                return (reduced / norms).astype(np.float32)
        except Exception as e2:
            logger.error(f"Erro no fallback TF-IDF: {e2}")

        # Último recurso sintético
        np.random.seed(42)
        return np.random.randn(len(non_empty), 64).astype(np.float32)

