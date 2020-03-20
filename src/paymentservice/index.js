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

require('@google-cloud/profiler').start({
  serviceContext: {
    service: 'paymentservice',
    version: '1.0.0'
  }
});

const tracing = require('@opencensus/nodejs');
const { JaegerTraceExporter } = require('@opencensus/exporter-jaeger');
var tracer = tracing.start({ samplingRate: 1 }).tracer;

if(process.env.DISABLE_TRACING) {
  console.log("Tracing disabled.")
}
else {
  console.log("Tracing enabled.")
  require('@google-cloud/trace-agent').start();

  const jaeger_host = process.env.JAEGER_SERVICE_ADDR.split(':')[0];
  const jaeger_port = parseInt(process.env.JAEGER_SERVICE_ADDR.split(':')[1], 10);

  tracer.registerSpanEventListener(new JaegerTraceExporter({
    host: jaeger_host,
    serviceName: 'paymentservice'
  }));
}

require('@google-cloud/debug-agent').start({
  serviceContext: {
    service: 'paymentservice',
    version: 'VERSION'
  }
});

tracer.startRootSpan({ name: 'main' }, rootSpan => {
  const path = require('path');
  const HipsterShopServer = require('./server');

  const PORT = process.env['PORT'];
  const PROTO_PATH = path.join(__dirname, '/proto/');

  const server = new HipsterShopServer(PROTO_PATH, PORT);

  server.listen();
  rootSpan.end();
});
