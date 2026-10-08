import numpy as np
import umap
import hdbscan
from typing import Tuple, Dict, List
import logging

logger = logging.getLogger(__name__)

class ClusteringEngine:
    @staticmethod
    def reduce_and_cluster(
        embeddings: np.ndarray,
        min_cluster_size: int = 15,
        min_samples: int = 5,
        n_neighbors: int = 15,
        target_dimensions: int = 5
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Executa a redução UMAP para espaço denso (target_dimensions) para clustering,
        redução paralela para 2D para visualização na UI,
        e clusterização via HDBSCAN.
        Retorna (cluster_labels, coordinates_2d, probabilities).
        """
        n_samples = len(embeddings)
        if n_samples == 0:
            return np.array([]), np.empty((0, 2)), np.array([])

        # Tratamento para datasets minúsculos (< 4 amostras)
        if n_samples < 4:
            labels = np.zeros(n_samples, dtype=int)
            coords_2d = np.zeros((n_samples, 2), dtype=float)
            for i in range(n_samples):
                coords_2d[i] = [float(i), float(i)]
            probs = np.ones(n_samples, dtype=float)
            return labels, coords_2d, probs

        # Ajuste adaptativo de hiperparâmetros para evitar erros de vizinhança
        eff_n_neighbors = max(2, min(n_neighbors, n_samples - 1))
        eff_min_cluster_size = max(2, min(min_cluster_size, max(2, n_samples // 3)))
        eff_min_samples = max(1, min(min_samples, eff_min_cluster_size))
        eff_target_dims = max(2, min(target_dimensions, n_samples - 2, embeddings.shape[1]))

        # 1. Redução de dimensionalidade intermediária para clustering (evita maldição da dimensionalidade)
        reducer_clustering = umap.UMAP(
            n_neighbors=eff_n_neighbors,
            n_components=eff_target_dims,
            metric="cosine",
            min_dist=0.0,
            random_state=42
        )
        reduced_embeddings_nd = reducer_clustering.fit_transform(embeddings)

        # 2. Redução paralela para 2D dedicada à plotagem visual na interface
        reducer_2d = umap.UMAP(
            n_neighbors=eff_n_neighbors,
            n_components=2,
            metric="cosine",
            min_dist=0.1,
            random_state=42
        )
        coordinates_2d = reducer_2d.fit_transform(embeddings)

        # 3. Agrupamento não-supervisionado com HDBSCAN
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=eff_min_cluster_size,
            min_samples=eff_min_samples,
            metric="euclidean",
            cluster_selection_method="eom",
            prediction_data=True
        )
        cluster_labels = clusterer.fit_predict(reduced_embeddings_nd)
        probabilities = getattr(clusterer, "probabilities_", np.ones(n_samples, dtype=float))

        return cluster_labels, coordinates_2d, probabilities

    @staticmethod
    def extract_exemplars(
        embeddings: np.ndarray,
        cluster_labels: np.ndarray,
        top_n: int = 4
    ) -> Dict[int, List[int]]:
        """
        Identifica os índices dos documentos mais representativos (exemplares)
        calculando a menor distância euclidiana até o centroide de cada cluster.
        """
        exemplars_by_cluster: Dict[int, List[int]] = {}
        unique_clusters = set(cluster_labels)

        for cluster in unique_clusters:
            if cluster == -1:
                continue  # Pula ruído

            cluster_indices = np.where(cluster_labels == cluster)[0]
            if len(cluster_indices) == 0:
                continue

            cluster_vectors = embeddings[cluster_indices]
            centroid = np.mean(cluster_vectors, axis=0)

            # Distância euclidiana de cada ponto ao centroide
            distances = np.linalg.norm(cluster_vectors - centroid, axis=1)
            sorted_local_indices = np.argsort(distances)

            # Pega os top_n mais próximos
            best_global_indices = cluster_indices[sorted_local_indices[:top_n]].tolist()
            exemplars_by_cluster[cluster] = best_global_indices

        return exemplars_by_cluster

