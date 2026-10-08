import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "TopicLens" in data["service"]

@pytest.mark.asyncio
async def test_upload_and_list_datasets(client: AsyncClient):
    # 1. Lista inicial vazia
    res = await client.get("/api/datasets")
    assert res.status_code == 200
    assert res.json() == []

    # 2. Upload de CSV sintético
    csv_content = b"feedback,customer_id,sentiment\n\"Excelente app, muito rapido e facil!\",101,positivo\n\"Trava ao abrir a camera\",102,negativo\n\"Nao consigo alterar senha\",103,negativo\n"
    files = {"file": ("test_feedbacks.csv", csv_content, "text/csv")}
    data = {"name": "Test Customer Feedbacks", "description": "Dataset de teste"}

    res_upload = await client.post("/api/datasets/upload", data=data, files=files)
    assert res_upload.status_code == 201
    created_dataset = res_upload.json()
    dataset_id = created_dataset["id"]
    assert created_dataset["name"] == "Test Customer Feedbacks"
    assert created_dataset["document_count"] == 3
    assert created_dataset["status"] == "UPLOADED"

    # 3. Consulta de detalhes
    res_get = await client.get(f"/api/datasets/{dataset_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == dataset_id

    # 4. Exclusão do dataset
    res_del = await client.delete(f"/api/datasets/{dataset_id}")
    assert res_del.status_code == 204

    # 5. Verifica se foi excluído
    res_after = await client.get(f"/api/datasets/{dataset_id}")
    assert res_after.status_code == 404

