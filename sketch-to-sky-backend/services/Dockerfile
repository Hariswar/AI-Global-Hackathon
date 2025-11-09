# Use the official lightweight Python image.
# https://hub.docker.com/_/python
FROM python:3.11-slim

# Copy application requirements
COPY requirements.txt .

# Install production dependencies.
RUN pip install --no-cache-dir -r requirements.txt

# Copy local code to the container image.
ENV APP_HOME /app
WORKDIR $APP_HOME
COPY . .

# Run uvicorn on container startup.
# The 0.0.0.0 address is required for Cloud Run, and $PORT is provided by the environment.
# --host 0.0.0.0 is crucial.
# We set the number of workers to 1 to match the single instance nature of Cloud Run.
CMD uvicorn app:app --host 0.0.0.0 --port $PORT --workers 1