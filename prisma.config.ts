services:
  db:
    image: postgres:16
    container_name: animedev_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: animedev
      POSTGRES_PASSWORD: animedev
      POSTGRES_DB: animedev
    ports:
      - "5433:5432"
    volumes:
      - animedev_pg:/var/lib/postgresql/data

volumes:
  animedev_pg: