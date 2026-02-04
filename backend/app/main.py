from fastapi import FastAPI

from app.routers import auth, finance, health, inventory, portioning, procurement, pricing, rbac, sales


def create_app() -> FastAPI:
    # App factory to keep side effects (like DB connection) explicit.
    app = FastAPI(title="Hugamara HMS API", version="0.1.0")

    app.include_router(health.router, tags=["health"])
    app.include_router(auth.router, tags=["auth"])
    app.include_router(rbac.router, tags=["rbac"])
    app.include_router(procurement.router, tags=["procurement"])
    app.include_router(inventory.router, tags=["inventory"])
    app.include_router(portioning.router, tags=["portioning"])
    app.include_router(finance.router, tags=["finance"])
    app.include_router(sales.router, tags=["sales"])
    app.include_router(pricing.router, tags=["pricing"])

    return app


app = create_app()
