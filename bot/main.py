"""NN Company CRM — Railway stub (bot runs on Vercel)"""
import os
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
