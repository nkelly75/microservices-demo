// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const path = require('path');
const grpc = require('grpc');
const pino = require('pino');
const protoLoader = require('@grpc/proto-loader');

const charge = require('./charge');

const logger = pino({
  name: 'paymentservice-server',
  messageKey: 'message',
  changeLevelName: 'severity',
  useLevelLabels: true
});

class HipsterShopServer {
  constructor (tracer, protoRoot, port = HipsterShopServer.PORT) {
    this.tracer = tracer;
    this.port = port;

    this.packages = {
      hipsterShop: this.loadProto(path.join(protoRoot, 'demo.proto')),
      health: this.loadProto(path.join(protoRoot, 'grpc/health/v1/health.proto'))
    };

    if (this.packages && this.packages.hipsterShop && this.packages.hipsterShop.hipstershop) {
      let hipstershop = this.packages.hipsterShop.hipstershop;
      // initialize client for calling ProductCatalogService
      this.productCatalogClient = new hipstershop.ProductCatalogService('productcatalogservice:3550',
        grpc.credentials.createInsecure());

      if (!this.productCatalogClient){
        logger.warn('Failed to initialize productCatalogClient');
      }
    }

    this.server = new grpc.Server();
    this.loadAllProtos(protoRoot);
  }

  /**
   * Handler for PaymentService.Charge.
   * @param {*} call  { ChargeRequest }
   * @param {*} callback  fn(err, ChargeResponse)
   */
  static ChargeServiceHandler (call, callback) {
    const tracer = this.tracer;
    const productCatalogClient = this.productCatalogClient;
    const currentSpan = tracer.getCurrentSpan();

    try {
      logger.info(`PaymentService#Charge invoked with request ${JSON.stringify(call.request)}`);

      const { transaction_id, delay, currency } = charge(call.request);
      const response = {
        transaction_id: transaction_id
      };
      if (currency) {
        currentSpan.setAttribute("currency", currency)
      }
      if (delay) {
        setTimeout(function() {
          callback(null, response);
        }, delay);
      } else {

        // Throw in a gRPC call to ProductCatalogService
        if (productCatalogClient && productCatalogClient.listProducts) {
          productCatalogClient.listProducts({}, function (error, listProductsResponse) {
            if (error) {
              logger.warn('error calling listProducts');
            } else {
              if (listProductsResponse.products && listProductsResponse.products.length) {
                logger.info(`got ${listProductsResponse.products.length} products`);
              }
            }
            callback(null, response);
          });
        } else {
          callback(null, response);
        }
      }
    } catch (err) {
      if (err.currency) {
        currentSpan.setAttribute("currency", err.currency)
      }
      console.warn(err);
      callback(err);
    }
  }

  static CheckHandler (call, callback) {
    callback(null, { status: 'SERVING' });
  }

  listen () {
    this.server.bind(`0.0.0.0:${this.port}`, grpc.ServerCredentials.createInsecure());
    logger.info(`PaymentService grpc server listening on ${this.port}`);
    this.server.start();
  }

  loadProto (path) {
    const packageDefinition = protoLoader.loadSync(
      path,
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );
    return grpc.loadPackageDefinition(packageDefinition);
  }

  loadAllProtos (protoRoot) {
    const hipsterShopPackage = this.packages.hipsterShop.hipstershop;
    const healthPackage = this.packages.health.grpc.health.v1;

    this.server.addService(
      hipsterShopPackage.PaymentService.service,
      {
        charge: HipsterShopServer.ChargeServiceHandler.bind(this)
      }
    );

    this.server.addService(
      healthPackage.Health.service,
      {
        check: HipsterShopServer.CheckHandler.bind(this)
      }
    );
  }
}

HipsterShopServer.PORT = process.env.PORT;

module.exports = HipsterShopServer;
