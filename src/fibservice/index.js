const tracer = require('./tracing')('adaptive-jazzy-silicon-k')
const express = require('express');
const url = require('url');
const http = require('http');

const app = express();
const promClient = require("prom-client");
const promBundle = require("express-prom-bundle");

app.set('etag', false);

const bundle = promBundle({
  buckets: [0.005, 0.01, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25],
  includeMethod: true,
  includePath: true,
  promClient: {
      collectDefaultMetrics: {
      }
  },
  urlValueParser: {
      minHexLength: 5,
      extraMasks: [
          "^[0-9]+\\.[0-9]+\\.[0-9]+$" // replace dot-separated dates with #val
      ]
  }
});

app.use(bundle);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.get('/foo', (req, res) => {
  res.send("hello!")
})

app.get(['/fib'], async (req, res) => {
  console.log(`/fib ${req.query.i}`);
  if (req.query.parallel === 'true') {
    tracer.getCurrentSpan().setAttribute("isParallel", true)
    req.url = '/fibParallel'
  } else {
    tracer.getCurrentSpan().setAttribute("isParallel", false)
    req.url = '/fibInternal'
  }
  if (req.query.i) {
    tracer.getCurrentSpan().setAttribute("iOuter", req.query.i)
  }
  return app._router.handle(req, res)
})


app.get(['/fibInternal'], async (req, res) => {
  // console.log(`/fibInternal ${req.query.i}`)
  let initialValue = parseInt(req.query.i);
  let returnValue = 0
  if ((initialValue === 0) || (initialValue === 1)) {
    returnValue = 0
  } else if (initialValue === 2) {
    returnValue = 1
  } else {
    let minusOneReturn = await makeRequest(`http://127.0.0.1:3090/fibInternal?i=${initialValue - 1}`)
    let minusTwoReturn = await makeRequest(`http://127.0.0.1:3090/fibInternal?i=${initialValue - 2}`)
    returnValue = minusOneReturn + minusTwoReturn 
  }

  res.send(returnValue.toString())
});

app.get('/fibParallel', async (req, res) => {
  let initialValue = parseInt(req.query.i)
  let returnValue = 0
  if ((initialValue === 0) || (initialValue === 1)) {
    returnValue = 0
  } else if (initialValue === 2) {
    returnValue = 1
  } else {
    let [resultMinusOne, resultMinusTwo] = await Promise.all([
      makeRequest(`http://127.0.0.1:3090/fibParallel?i=${initialValue - 1}`),
      makeRequest(`http://127.0.0.1:3090/fibParallel?i=${initialValue - 2}`)
    ])
    returnValue = resultMinusOne + resultMinusTwo 
  }

  res.send(returnValue.toString())
})

function makeRequest(url) {
  return new Promise ((resolve, reject) => {
    let data = '';
    http.get(url, (res) => {
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve(parseInt(data))
      })
      res.on('error', err => {
        reject(err)
      })
    });
  });
}

app.listen(process.env.PORT || 3090, () => console.log("Listening to port 3090"));
