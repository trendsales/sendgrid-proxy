const azure = require('azure-storage');
const crypto = require('crypto');
const https = require('https');

const connectionString = process.env.CONNECTION_STRING;
const tableSvc = azure.createTableService(connectionString);
const tableName = process.env.TABLENAME || 'sendgridproxy';

// Header fields from the sendgrid to be forwarded to the caller
const proxyHeaders = [
  'content-type',
  'X-Message-Id',
  'Content-Length',
  'Date',
];

// Used for mapping additional input values from body to the resulting row
const values = {
  categories: body => (body.categories || []).join(', '),
}

const uniqueCategories = (process.env.UNIQUE_CATEGORIES || '').split(',').map(i => i.trim());

const cleanup = (obj) => obj ? Object.keys(obj).reduce((output, i) => {
  output[i] = obj[i]._ || obj[i];
  return output;
}, {}) : undefined;


const createTable = () => new Promise((resolve, reject) => {
  tableSvc.createTableIfNotExists(tableName, (error, result, response) => {
    if(error){
      reject(err);
    } else {
      resolve();
    }
  });
});

const update = (entry) => new Promise((resolve, reject) => {
  tableSvc.insertOrReplaceEntity(tableName, entry, (error, result, response) => {
    if(error){
      reject(error);
    } else {
      resolve();
    }
  });
});

const get = (partitionKey, rowKey) => new Promise((resolve, reject) => {
  tableSvc.retrieveEntity(tableName, partitionKey, rowKey, (error, result, response) => {
    if(error){
      resolve(undefined);
    } else {
      resolve(result);
    }
  });
});

const send = (method, headers, body) => new Promise((resolve, reject) => {
  var options = {
    headers: {
      ...headers,
      host: 'api.sendgrid.com',
      path: '/v3/mail/send',
    },
    method,
    host: 'api.sendgrid.com',
    path: '/v3/mail/send',
  };

  let responseBody = '';
  let responseHeaders = {};
  let statusCode = -1;

  const req = https.request(options, (res) => {
    responseHeaders = res.headers;
    statusCode = res.statusCode;
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      responseBody += chunk;
    });
    res.on('end', (chunk) => {
      resolve({
        headers: responseHeaders,
        body: responseBody,
        statusCode,
      })
    });
  });

  req.on('error', function(error) {
    reject({
      error,
      headers: responseHeaders,
      body: responseBody,
      statusCode,
    });
  });

  req.write(body);
  req.end();
});

const handleRequest = async (context) => {
  const body = context.req.rawBody;
  const headers = context.req.headers;
  const categories = context.req.body.categories || ['unset'];

  const partitionKey = categories.join('');
  const rowKey = crypto.createHash('sha256').update(body).digest('hex');
  const unique = !!categories.find(c => uniqueCategories.includes(c));

  const current = {
    PartitionKey: {'_' : partitionKey},
    RowKey: {'_': rowKey},
    requestID: {'_': rowKey},
    requestBody: {'_': body},
    requestHeaders: {'_': JSON.stringify(headers)},
    responseBody: {'_': ''},
    responseHeaders: {'_': JSON.stringify({})},
    messageId: {'_': ''},
    unique: {'_': unique},
    statusCode: {'_': -1},
    send: {'_': false},
    count: {'_': 1},
  };

  const addKeys = Object.keys(values).forEach(key => {
    current[key] = {
      _: values[key](context.req.body),
    };
  });

  const handleSend = async () => {
    try {
      const response = await send(context.req.method, headers, body);
      current.responseBody._ = response.body;
      current.statusCode._ = response.statusCode;
      current.responseHeaders._ = JSON.stringify(response.headers);
      current.messageId._ = response.headers['X-Message-Id'] || '';
      current.send._ = true;
    } catch (error) {
      current.responseBody._ = error.body;
      current.statusCode._ = error.statusCode;
      current.responseHeaders._ = JSON.stringify(error.headers);
      current.error = {
        _: error.error,
        $: 'Edm.Boolean',
      };
    }
  };

  await createTable();
  const previous = await get(partitionKey, rowKey);
  if (previous) {
    current.count._ = previous.count._ + 1;
    if (!unique) {
      await handleSend();
    }
  } else {
    await handleSend();
  }
  const responseHeaders = JSON.parse(current.responseHeaders._);
  const newHeaders = proxyHeaders.reduce((output, i) => {
    output[i] = responseHeaders[i];
    return output;
  }, {});
  context.res = {
    status: current.statusCode._ > 0 ? current.statusCode._ : 200,
    headers: newHeaders,
    body: current.responseBody._,
  };
  await update(current);
};

module.exports = async (context) => {
  try {
    await handleRequest(context);
  } catch (err) {
    context.res.status = 500;
    context.log(err);
  }
}
