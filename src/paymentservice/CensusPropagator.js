"use strict";
/*!
 * Copyright 2019, OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("@opentelemetry/api");
// const context_1 = require("../context");
// const context_base_1 = require("@opentelemetry/context-base");

// import { getParentSpanContext, setExtractedSpanContext } from '../context';
const { getParentSpanContext, setExtractedSpanContext } = require("@opentelemetry/core");



/** The metadata key under which span context is stored as a binary value. */
exports.GRPC_TRACE_KEY = 'grpc-trace-bin';
exports.X_B3_TRACE_ID = 'x-b3-traceid';
exports.X_B3_SPAN_ID = 'x-b3-spanid';
exports.X_B3_SAMPLED = 'x-b3-sampled';
const VALID_TRACEID_REGEX = /^[0-9a-f]{32}$/i;
const VALID_SPANID_REGEX = /^[0-9a-f]{16}$/i;
const INVALID_ID_REGEX = /^0+$/i;
function isValidTraceId(traceId) {
    return VALID_TRACEID_REGEX.test(traceId) && !INVALID_ID_REGEX.test(traceId);
}
function isValidSpanId(spanId) {
    return VALID_SPANID_REGEX.test(spanId) && !INVALID_ID_REGEX.test(spanId);
}
const VERSION_ID = 0;
const TRACE_ID_FIELD_ID = 0;
const SPAN_ID_FIELD_ID = 1;
const TRACE_OPTION_FIELD_ID = 2;
// Sizes are number of bytes.
const ID_SIZE = 1;
const TRACE_ID_SIZE = 16;
const SPAN_ID_SIZE = 8;
const TRACE_OPTION_SIZE = 1;
const VERSION_ID_OFFSET = 0;
const TRACE_ID_FIELD_ID_OFFSET = VERSION_ID_OFFSET + ID_SIZE;
const TRACE_ID_OFFSET = TRACE_ID_FIELD_ID_OFFSET + ID_SIZE;
const SPAN_ID_FIELD_ID_OFFSET = TRACE_ID_OFFSET + TRACE_ID_SIZE;
const SPAN_ID_OFFSET = SPAN_ID_FIELD_ID_OFFSET + ID_SIZE;
const TRACE_OPTION_FIELD_ID_OFFSET = SPAN_ID_OFFSET + SPAN_ID_SIZE;
const TRACE_OPTIONS_OFFSET = TRACE_OPTION_FIELD_ID_OFFSET + ID_SIZE;
const FORMAT_LENGTH = 4 * ID_SIZE + TRACE_ID_SIZE + SPAN_ID_SIZE + TRACE_OPTION_SIZE;
/**
 * Serialize the given span context into a Buffer.
 * @param spanContext The span context to serialize.
 */
function serializeSpanContext(spanContext) {
    /**
     *  0           1           2
     *  0 1 2345678901234567 8 90123456 7 8
     * -------------------------------------
     * | | |                | |        | | |
     * -------------------------------------
     *  ^ ^      ^           ^    ^     ^ ^
     *  | |      |           |    |     | `-- options value (spanContext.options)
     *  | |      |           |    |     `---- options field ID (2)
     *  | |      |           |    `---------- spanID value (spanContext.spanID)
     *  | |      |           `--------------- spanID field ID (1)
     *  | |      `--------------------------- traceID value (spanContext.traceID)
     *  | `---------------------------------- traceID field ID (0)
     *  `------------------------------------ version (0)
     */
    // Node gRPC library expects a `Buffer` for storing metadata header
    // (MetadataValue) when the normalized key ends with '-bin'.
    const result = Buffer.alloc(FORMAT_LENGTH, 0);
    result.write(spanContext.traceId, TRACE_ID_OFFSET, TRACE_ID_SIZE, 'hex');
    result.writeUInt8(SPAN_ID_FIELD_ID, SPAN_ID_FIELD_ID_OFFSET);
    result.write(spanContext.spanId, SPAN_ID_OFFSET, SPAN_ID_SIZE, 'hex');
    result.writeUInt8(TRACE_OPTION_FIELD_ID, TRACE_OPTION_FIELD_ID_OFFSET);
    result.writeUInt8(spanContext.options || 0, TRACE_OPTIONS_OFFSET);
    return result;
}
exports.serializeSpanContext = serializeSpanContext;
/**
 * Deseralize the given span context from binary encoding. If the input is a
 * Buffer of incorrect size or unexpected fields, then this function will return
 * null.
 * @param buffer The span context to deserialize.
 */
function deserializeSpanContext(buffer) {
    const result = { traceId: '', spanId: '' };
    // Length must be 29.
    if (buffer.length !== FORMAT_LENGTH) {
        return null;
    }
    // Check version and field numbers.
    if (buffer.readUInt8(VERSION_ID_OFFSET) !== VERSION_ID ||
        buffer.readUInt8(TRACE_ID_FIELD_ID_OFFSET) !== TRACE_ID_FIELD_ID ||
        buffer.readUInt8(SPAN_ID_FIELD_ID_OFFSET) !== SPAN_ID_FIELD_ID ||
        buffer.readUInt8(TRACE_OPTION_FIELD_ID_OFFSET) !== TRACE_OPTION_FIELD_ID) {
        return null;
    }
    // See serializeSpanContext for byte offsets.
    result.traceId = buffer
        .slice(TRACE_ID_OFFSET, SPAN_ID_FIELD_ID_OFFSET)
        .toString('hex');
    result.spanId = buffer
        .slice(SPAN_ID_OFFSET, TRACE_OPTION_FIELD_ID_OFFSET)
        .toString('hex');
    result.options = buffer.readUInt8(TRACE_OPTIONS_OFFSET);
    return result;
}
exports.deserializeSpanContext = deserializeSpanContext;

// function setExtractedSpanContext(context, spanContext) {
//     return context.setValue(EXTRACTED_SPAN_CONTEXT_KEY, spanContext);
// }

/**
 * Propagator for the B3 HTTP header format.
 * Based on: https://github.com/openzipkin/b3-propagation
 */
class CensusPropagator {
    inject(context, carrier, setter) {
        const spanContext = context_1.getParentSpanContext(context);
        if (!spanContext)
            return;
        if (isValidTraceId(spanContext.traceId) &&
            isValidSpanId(spanContext.spanId)) {
            setter(carrier, exports.X_B3_TRACE_ID, spanContext.traceId);
            setter(carrier, exports.X_B3_SPAN_ID, spanContext.spanId);
            // We set the header only if there is an existing sampling decision.
            // Otherwise we will omit it => Absent.
            if (spanContext.traceFlags !== undefined) {
                setter(carrier, exports.X_B3_SAMPLED, (api_1.TraceFlags.SAMPLED & spanContext.traceFlags) === api_1.TraceFlags.SAMPLED
                    ? '1'
                    : '0');
            }
        }
    }
    extract(context, carrier, getter) {
        // const grpcTraceBin = getter(carrier, GRPC_TRACE_KEY);
        // const censusSpanContext = deserializeSpanContext(grpcTraceBin);
        // console.log(`** In CensusPropagator.extract with context: ${context} carrier: ${carrier} getter: ${getter}`);
        if (carrier) {
            const carrierAsMetadata = carrier;
            const metadataValue = carrierAsMetadata.getMap()[exports.GRPC_TRACE_KEY];
            if (!metadataValue) {
                console.log('** no value for metadataValue');
                return context;
            } else {
                console.log('** In CensusPropagator.extract got buffer');
                const censusSpanContext = deserializeSpanContext(metadataValue);
                console.log('** In CensusPropagator.extract called deserialize');
                if (censusSpanContext) {
                    console.log(`** got censusSpanContext`);

                    const traceId = censusSpanContext.traceId;
                    const spanId = censusSpanContext.spanId;
                    const options = censusSpanContext.options;

                    if (typeof traceId !== 'string' || typeof spanId !== 'string') {
                        console.log(`** unexpected Ids`);
                        return context;                        
                    }
                    if (isValidTraceId(traceId) && isValidSpanId(spanId)) {
                        console.log(`** valid Ids ${traceId} ${spanId} ${options}`);
                        const traceFlags = isNaN(Number(options)) ? api_1.TraceFlags.NONE : Number(options);
                        console.log(`** traceFlags: ${traceFlags}`);
                        // from ./node_modules/@opentelemetry/core/build/src/context/context.js
                        return setExtractedSpanContext(context, {
                            traceId,
                            spanId,
                            isRemote: true,
                            traceFlags: isNaN(Number(options)) ? api_1.TraceFlags.NONE : Number(options),
                        });
                    } else {
                        console.log(`** invalid Ids`);
                    }
                    return context;
                } else {
                    console.log(`** no value for censusSpanContext`);
                    return context;
                }   
            }
        }
        return context;
    }
}
exports.CensusPropagator = CensusPropagator;
//# sourceMappingURL=CensusPropagator.js.map