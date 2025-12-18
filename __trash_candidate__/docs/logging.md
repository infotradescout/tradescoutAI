# PHASE 2.4: Advanced Log Aggregation

## Best Practices
- Use a centralized log system (ELK Stack, Loki, or cloud logging)
- Forward app logs (stdout/stderr) and NGINX logs to the aggregator
- Use structured JSON logs for app (PM2 supports this)
- Set up log rotation and retention policies

## Example: Loki + Grafana
1. Deploy Loki and Grafana in your cluster/cloud
2. Use Promtail or Fluent Bit to collect logs from containers
3. Add Loki as a data source in Grafana
4. Create dashboards and alerts for error rates, latency, etc.

## Example: ELK Stack
1. Deploy Elasticsearch, Logstash, Kibana
2. Forward logs from containers to Logstash
3. Visualize and search logs in Kibana

## Cloud Logging
- AWS CloudWatch, GCP Logging, Azure Monitor: use their agents to collect logs

## NGINX
- Forward `/var/log/nginx/access.log` and `error.log` to your aggregator

## App
- PM2 logs: `docker-compose exec app pm2 logs`
- Use `pm2 install pm2-logrotate` for log rotation
