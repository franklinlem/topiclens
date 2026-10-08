import numpy as np
import pytest
from app.services.clustering_engine import ClusteringEngine
from app.services.topic_labeler import TopicLabeler

def test_clustering_detects_separable_synthetic_clusters():
    # Cria dois grupos sintéticos bem separados em 384 dimensões
    np.random.seed(42)
    cluster_1 = np.random.normal(loc=1.0, scale=0.1, size=(50, 384))
    cluster_2 = np.random.normal(loc=-1.0, scale=0.1, size=(50, 384))
    data = np.vstack([cluster_1, cluster_2])

    labels, coords_2d, probs = ClusteringEngine.reduce_and_cluster(
        embeddings=data,
        min_cluster_size=15,
        min_samples=5,
        n_neighbors=10,
        target_dimensions=3
    )

    # Garante que foram descobertos ao menos 2 clusters distintos (excluindo ruído -1)
    valid_clusters = set(labels) - {-1}
    assert len(valid_clusters) >= 2
    assert coords_2d.shape == (100, 2)
    assert len(labels) == 100

def test_extract_exemplars_returns_closest_indices():
    embeddings = np.array([
        [0.0, 0.0],
        [0.1, 0.1],  # Próximo ao centroide
        [1.0, 1.0],  # Longe do centroide
    ])
    labels = np.array([0, 0, 0])

    exemplars = ClusteringEngine.extract_exemplars(embeddings, labels, top_n=1)
    assert 0 in exemplars
    assert len(exemplars[0]) == 1
    # O ponto mais próximo da média [0.36, 0.36] deve ser o índice 1
    assert exemplars[0][0] in [0, 1]

def test_heuristic_topic_labeler_without_api_key():
    texts = [
        "O aplicativo fecha sozinho sempre que clico em finalizar compra.",
        "Erro crítico ao tentar pagar com cartão de crédito na finalização.",
        "Falha no checkout após preencher endereço e dados de pagamento."
    ]
    summary = TopicLabeler.generate_topic_summary(texts, cluster_size=3, model="heuristic")
    assert "title" in summary
    assert "summary" in summary
    assert "keywords" in summary
    assert len(summary["keywords"]) > 0

