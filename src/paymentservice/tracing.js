const { LogLevel, ConsoleLogger /*, B3Propagator, CompositePropagator */ } = require("@opentelemetry/core");
const opentelemetry = require("@opentelemetry/api");
const { NodeTracerProvider } = require("@opentelemetry/node");
const {
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ConsoleSpanExporter
} = require("@opentelemetry/tracing");
const { JaegerExporter } = require("@opentelemetry/exporter-jaeger");
const { LightstepExporter } = require("lightstep-opentelemetry-exporter");
const { CensusPropagator } = require("./CensusPropagator");

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

  // const provider = new NodeTracerProvider({ logLevel: LogLevel.ERROR });

  const provider = new NodeTracerProvider({
    logLevel: LogLevel.DEBUG,
    // propagators: new CensusPropagator(),
    plugins: {
      grpc: {
        enabled: true,
        path: '@opentelemetry/plugin-grpc',
      },
    },
  });

  console.log(`** Created provider`);

  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));

  if (process.env.JAEGER_HOST) {
    console.log(`${process.env.JAEGER_HOST} ${serviceName}`);
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

  provider.register(
    {
      propagator: new CensusPropagator()
      // propagator: new B3Propagator(),
      // propagator: new CompositePropagator(),
    }
  );
  console.log(`** Registered provider`);
  if (opentelemetry.propagation) {
    console.log(`** Found propagation in API`);
    if (opentelemetry.propagation._propagator) {
      console.log(`** Found _propagator in API ${JSON.stringify(opentelemetry.propagation._propagator)}`);
    }
  }
  

  return opentelemetry.trace.getTracer(serviceName);
};
