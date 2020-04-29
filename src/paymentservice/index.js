/*
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { MeterProvider }  = require('@opentelemetry/metrics');

// const client = require('prom-client');
// const collectDefaultMetrics = client.collectDefaultMetrics;
const { collectDefaultMetrics } = require('prom-client');

// Add your port and startServer to the Prometheus options
const options = {port: 9464, startServer: true};
const exporter = new PrometheusExporter(options);

// The OTel PrometheusExporter doesn't seem to expose the ability to
// use collectDefaultMetrics. This workaround is poking into using its private
// _registry property.
if (exporter._registry) {
  collectDefaultMetrics({ register: exporter._registry });
}

require('@google-cloud/profiler').start({
  serviceContext: {
    service: 'paymentservice',
    version: '1.0.0'
  }
});

const tracer = require('./tracing')('paymentservice')

if(process.env.DISABLE_TRACING) {
  console.log("Tracing disabled.")
}
else {
  console.log("Tracing enabled.")
}

require('@google-cloud/debug-agent').start({
  serviceContext: {
    service: 'paymentservice',
    version: 'VERSION'
  }
});

// Register the exporter
const meter = new MeterProvider({
  exporter,
  interval: 1000,
}).getMeter('example-prometheus');

// Now, start recording data
const counter = meter.createCounter('metric_name');
counter.add(10, {});

// tracer.startRootSpan({ name: 'main' }, rootSpan => {
  const path = require('path');
  const HipsterShopServer = require('./server');

  const PORT = process.env['PORT'];
  const PROTO_PATH = path.join(__dirname, '/proto/');

  const server = new HipsterShopServer(tracer, PROTO_PATH, PORT);

  server.listen();
//   rootSpan.end();
// });
