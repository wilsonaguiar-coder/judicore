import { Client } from "@elastic/elasticsearch";

let _client: Client | null = null;

export function getElasticsearchClient(): Client {
  if (!_client) {
    const url = process.env["ELASTICSEARCH_URL"];
    if (!url) throw new Error("ELASTICSEARCH_URL não definida");
    _client = new Client({ node: url });
  }
  return _client;
}
