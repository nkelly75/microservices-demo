const { LogLevel, ConsoleLogger } = require("@opentelemetry/core");
const opentelemetry = require("@opentelemetry/api");
const { NodeTracerProvider } = require("@opentelemetry/node");
const {
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ConsoleSpanExporter
} = require("@opentelemetry/tracing");
const { JaegerExporter } = require("@opentelemetry/exporter-jaeger");
const { LightstepExporter } = require("lightstep-opentelemetry-exporter");
const { GrpcCensusPropagator } = require("@opentelemetry/propagator-grpc-census-binary");

class HealthcheckSampler {
  shouldSample(parentContext) {

    // console.log(`** HealthSampler parentContext=${JSON.stringify(parentContext)}`);
    let decision = true;

    // Respect the parent sampling decision if there is one
    if (parentContext && typeof parentContext.traceFlags !== 'undefined') {
      console.log(`** HealthSampler respecting parent sampling decision`);
      decision = (
        (1 & parentContext.traceFlags) === 1
      );
      // TODO remove
      // decision = Math.random() < 0.5;
    } else if (typeof parentContext === 'undefined') {
      // Hack to detect HealthCheck vs real call from instrumented client
      decision = false;
    } else {
      decision = true;
      // TODO remove
      // decision = Math.random() < 0.5;
    }

    console.log(`** HealthSampler decision=${decision}`);

    return decision;
  }
}

module.exports = serviceName => {
  const jaegerOptions = {
    serviceName: serviceName,
    host: process.env.JAEGER_HOST,
    port: process.env.JAEGER_PORT
  };

  const lightstepOptions = {
    serviceName: serviceName,
    token: process.env.LIGHTSTEP_KEY
  };

  // Prep config for NodeTracerProvider
  const tracerConfig = {
    logLevel: LogLevel.ERROR,
    // propagators: new CensusPropagator(),
    plugins: {
      grpc: {
        enabled: true,
        path: '@opentelemetry/plugin-grpc',
      },
    },
    sampler: new HealthcheckSampler()
  };
  if (process.env.SERVICE_VERSION) {
    tracerConfig.defaultAttributes = {
      'service.version': process.env.SERVICE_VERSION
    }
  }

  const provider = new NodeTracerProvider(tracerConfig);

  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

  if (process.env.JAEGER_HOST) {
    console.log(`Adding jaeger exporter to host: ${process.env.JAEGER_HOST} for service: ${serviceName}`);
    provider.addSpanProcessor(
      new BatchSpanProcessor(new JaegerExporter(jaegerOptions))
    );
  }

  if (process.env.LIGHTSTEP_KEY) {
    console.log(`Adding lighstep exporter for service: ${serviceName}`);
    provider.addSpanProcessor(
      new BatchSpanProcessor(new LightstepExporter(lightstepOptions))
    );
  }

  // Register GrpcCensusPropagator so we can use the 'grpc-trace-bin' header
  // in gRPC calls.
  provider.register(
    {
      propagator: new GrpcCensusPropagator()
    }
  );
  
  return opentelemetry.trace.getTracer(serviceName);
};
