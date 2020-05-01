# Prometheus Experiments

This folder contains files created while working on Prometheus experiments including:
- enabling the microk8s prometheus addon (which includes a Prometheus instance configured to monitor the cluster as well as a Grafana instance for charting)
- creating a ServiceMonitor to help with service discovery (of k8s services labelled with tier: frontend) see [servicemonitor-fibservice.yaml](./servicemonitor-fibservice.yaml). Also note the significance of the *tier* label and port called *web* in [fibservice.yaml](../../kubernetes-manifests/fibservice.yaml)
- creating a Prometheus operator that watches ServiceMonitors see [service-prometheus.yaml](./service-prometheus.yaml) and helps configure a second Prometheus instance geared towards applications
- putting a k8s service in front of the second Prometheus instance see [prometheus-svc.yaml](./prometheus-svc.yaml)
- configuring the existing Grafana with a second datasource for the second Prom instance see [datasources.yaml](./datasources.yaml)
- backing up the JSON for a basic Grafana dashboard that queries the new Prom instance see [fibServiceDashboard.json](./fibServiceDashboard.json)
- creating a k8s ingress to make the second Prom instance available outside the microk8s cluster see [promIngress.yml](./promIngress.yml)
- configuring some rules on the second Prom instance
  - alert rules (really just to test initial rule config) see [service-prom-alert-rules.yaml](./service-prom-alert-rules.yaml)
  - recording rules (to prove we don't have to pull **everything** via federation) see [service-prom-rec-rules.yaml](./service-prom-rec-rules.yaml)
- tweaking [service-prometheus.yaml](./service-prometheus.yaml) so the operator would pick up PrometheusRule objects with roles of either *alert-rules* or *recording-rules*
- testing federation from an external (outside the microk8s cluster) Prometheus instance see [prom_fed.yml](./prom_fed.yml)
