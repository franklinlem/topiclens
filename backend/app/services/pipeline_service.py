import time
import uuid
import logging
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.dataset import Dataset
from app.models.topic import Topic
from app.models.document import Document
from app.schemas.analysis import ClusteringParameters
from app.services.embedding_service import EmbeddingService
from app.services.clustering_engine import ClusteringEngine
from app.services.topic_labeler import TopicLabeler

logger = logging.getLogger(__name__)

class PipelineService:
    @classmethod
    async def run_analysis(
        cls,
        dataset_id: str,
        params: ClusteringParameters,
        session: AsyncSession
    ) -> None:
        """
        Executa a esteira analítica completa de 5 passos para o dataset:
        1. Pré-processamento e leitura de documentos
        2. Extração de embeddings vetoriais
        3. Redução UMAP (5D e 2D) e Clusterização HDBSCAN
        4. Identificação de exemplares centrais
        5. Síntese executiva de tópicos via LLM
        6. Persistência consolidada e atualização de status
        """
        start_time = time.time()
        logger.info(f"Iniciando pipeline analítico para o dataset: {dataset_id}")

        try:
            # 1. Recupera o dataset e documentos
            res = await session.execute(select(Dataset).where(Dataset.id == dataset_id))
            dataset = res.scalar_one_or_none()
            if not dataset:
                logger.error(f"Dataset {dataset_id} não encontrado.")
                return

            dataset.status = "PROCESSING"
            dataset.progress_percent = 10
            dataset.progress_message = "1/5: Extraindo e pré-processando textos..."
            await session.commit()

            doc_query = await session.execute(
                select(Document).where(Document.dataset_id == dataset_id).order_by(Document.created_at)
            )
            documents = list(doc_query.scalars().all())

            if not documents:
                dataset.status = "FAILED"
                dataset.error_message = "Nenhum documento encontrado para processamento."
                await session.commit()
                return

            texts = [doc.clean_text or doc.original_text for doc in documents]

            # 2. Extração de Embeddings
            dataset.progress_percent = 30
            dataset.progress_message = f"2/5: Computando embeddings semânticos ({len(texts)} textos)..."
            await session.commit()

            embeddings = EmbeddingService.extract_embeddings(texts)

            # 3. Redução Dimensional e Agrupamento HDBSCAN
            dataset.progress_percent = 55
            dataset.progress_message = "3/5: Reduzindo dimensionalidade (UMAP) e agrupando clusters (HDBSCAN)..."
            await session.commit()

            labels, coords_2d, probabilities = ClusteringEngine.reduce_and_cluster(
                embeddings=embeddings,
                min_cluster_size=params.min_cluster_size,
                min_samples=params.min_samples,
                n_neighbors=params.n_neighbors_umap,
                target_dimensions=params.umap_components
            )

            # 4. Extração de Exemplares Centrais
            dataset.progress_percent = 70
            dataset.progress_message = "4/5: Identificando documentos exemplares e centroides..."
            await session.commit()

            exemplars_map = ClusteringEngine.extract_exemplars(embeddings, labels, top_n=4)
            exemplar_indices_set = {idx for idx_list in exemplars_map.values() for idx in idx_list}

            # Limpar tópicos anteriores caso seja reprocessamento
            await session.execute(delete(Topic).where(Topic.dataset_id == dataset_id))
            await session.commit()

            # 5. Síntese de Tópicos via LLM
            dataset.progress_percent = 85
            dataset.progress_message = "5/5: Sintetizando títulos e resumos executivos via LLM..."
            await session.commit()

            unique_clusters = sorted(list(set(labels)))
            topics_to_create = []
            topic_by_cluster_id = {}

            total_clustered_count = sum(1 for l in labels if l != -1)

            for c_label in unique_clusters:
                c_indices = np.where(labels == c_label)[0]
                cluster_count = len(c_indices)
                percentage = round((cluster_count / len(documents)) * 100, 2)

                if c_label == -1:
                    # Ruído / Não agrupado
                    t_obj = Topic(
                        id=str(uuid.uuid4()),
                        dataset_id=dataset_id,
                        cluster_label=-1,
                        title="Documentos Não Agrupados (Ruído)",
                        summary=f"Grupo de {cluster_count} documentos com semântica dispersa que não formaram grupos densos.",
                        keywords=["disperso", "heterogêneo", "ruído"],
                        document_count=cluster_count,
                        percentage=percentage,
                        density_score=0.0
                    )
                else:
                    cluster_exemplar_idxs = exemplars_map.get(c_label, c_indices[:4].tolist())
                    exemplar_texts = [texts[idx] for idx in cluster_exemplar_idxs]

                    # Síntese via LLM
                    summary_data = TopicLabeler.generate_topic_summary(
                        exemplar_texts=exemplar_texts,
                        cluster_size=cluster_count,
                        model=params.llm_model
                    )

                    t_obj = Topic(
                        id=str(uuid.uuid4()),
                        dataset_id=dataset_id,
                        cluster_label=c_label,
                        title=summary_data["title"],
                        summary=summary_data["summary"],
                        keywords=summary_data["keywords"],
                        document_count=cluster_count,
                        percentage=percentage,
                        density_score=float(np.mean(probabilities[c_indices])) if len(c_indices) > 0 else 0.5
                    )

                session.add(t_obj)
                topics_to_create.append(t_obj)
                topic_by_cluster_id[c_label] = t_obj

            # Atualizar cada documento com suas coordenadas, cluster e exemplar status
            for idx, doc in enumerate(documents):
                doc.cluster_label = int(labels[idx])
                doc.coord_x = float(coords_2d[idx, 0])
                doc.coord_y = float(coords_2d[idx, 1])
                doc.is_exemplar = bool(idx in exemplar_indices_set)
                if doc.cluster_label in topic_by_cluster_id:
                    doc.topic_id = topic_by_cluster_id[doc.cluster_label].id

            # 6. Finalização e atualização do dataset
            dataset.status = "COMPLETED"
            dataset.progress_percent = 100
            elapsed = round(time.time() - start_time, 2)
            dataset.progress_message = f"Análise concluída com sucesso em {elapsed}s!"
            await session.commit()

            logger.info(f"Pipeline finalizado com sucesso para o dataset {dataset_id} em {elapsed}s.")

        except Exception as exc:
            logger.exception(f"Erro na execução da esteira para dataset {dataset_id}: {exc}")
            try:
                res = await session.execute(select(Dataset).where(Dataset.id == dataset_id))
                dataset = res.scalar_one_or_none()
                if dataset:
                    dataset.status = "FAILED"
                    dataset.error_message = str(exc)
                    dataset.progress_message = f"Falha na análise: {str(exc)[:150]}"
                    await session.commit()
            except Exception as inner_e:
                logger.error(f"Erro ao atualizar status de falha: {inner_e}")

