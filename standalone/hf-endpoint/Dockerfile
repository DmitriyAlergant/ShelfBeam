FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime

RUN pip install --no-cache-dir \
    "transformers>=5.0.0" \
    "accelerate>=0.26.0" \
    "Pillow>=10.0.0" \
    "fastapi[standard]" \
    einops

WORKDIR /app
COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
