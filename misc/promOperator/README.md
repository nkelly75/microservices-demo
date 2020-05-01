# Prometheus Experiments

This folder contains files created while working on Prometheus experiments including:
- enabling the microk8s prometheus addon
- creating a ServiceMonitor to help with service discovery (of k8s services labelled with tier: frontend) see [servicemonitor-fibservice.yaml](./misc/promOperator/servicemonitor-fibservice.yaml). Also note the significance of the *tier* label and port called *web* in [fibservice.yaml](../../kubernetes-manifests/fibservice.yaml)
- creating a Prometheus operator that watches ServiceMonitors see [service-prometheus.yaml](./misc/promOperator/service-prometheus.yaml)

