from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_capabilities_do_not_claim_live_data():
    response = client.get("/api/v1/capabilities")
    assert response.status_code == 200
    assert response.json()["market_data_live"] is False
