from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import Base, engine

from app.api.routes import auth


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    max_age=0,
    # Allows specific origins (use ["*"] for all)
    allow_origins=["*"],
    allow_credentials=True,  # Allows cookies and authentication headers
    # Allows all HTTP methods (GET, POST, etc.)
    allow_methods=["*"],
    allow_headers=["*"],  # Allows all headers
)

Base.metadata.create_all(bind=engine)

app.include_router(
    router=auth.router,
    prefix="/auth",
    tags=["Auth"]
)


@app.head("/")
def test():
    return Response(status_code=200)
