const azure = require('azure-storage');
const crypto = require('crypto');
const https = require('https');

const connectionString = process.env.CONNECTION_STRING;
const tableSvc = azure.createTableService(connectionString);
const tableName = process.env.TABLENAME || 'sendgridproxy';

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

const send = (headers, body) => new Promise((resolve, reject) => {
  var options = {
    ...headers,
    host: '',
    path: '',
  };

  let responseBody = '';
  let responseHeaders = {};
  let statusCode;

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

  const partitionKey = context.req.body.category || 'unset';
  const rowKey = crypto.createHash('sha256').update(body).digest('hex');
  const unique = uniqueCategories.includes(partitionKey);

  const current = {
    PartitionKey: {'_' : partitionKey},
    RowKey: {'_': rowKey},
    requestID: {'_': rowKey},
    requestBody: {'_': body, '$': 'Edm.String'},
    requestHeaders: {'_': JSON.stringify(headers), '$': 'Edm.String'},
    responseBody: {'_': '', '$': 'Edm.String'},
    responseHeaders: {'_': JSON.stringify({}), '$': 'Edm.String'},
    unique: {'_': unique, '$': 'Edm.Boolean'},
    statusCode: {'_': -1, '$': 'Edm.Int32'},
    send: {'_': false, '$': 'Edm.Boolean'},
    count: {'_': 1, '$': 'Edm.Int32'},
  };

  const handleSend = async () => {
    try {
      const response = await send(headers, body);
      current.responseBody._ = response.body;
      current.statusCode._ = response.statusCode;
      current.responseHeaders._ = JSON.stringify(response.headers);
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
      //await handleSend();
    }
  } else {
    //await handleSend();
  }
  context.log(current);
  await update(current);
};

module.exports = async (context) => {
  try {
    await handleRequest(context);
  } catch (err) {
    context.log(err);
  }
}
