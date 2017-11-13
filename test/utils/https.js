const entries = [];

exports.getData = () => entries;

class Response {
  constructor() {
    this.headers = {
      'X-Message-Id': 'msg-id',
    };
    this.statusCode = 204;
    this.listeners = [];
  }

  setEncoding() {

  }

  on(type, callback) {
    this.listeners.push(callback);
  }

  run() {
    this.listeners.forEach((l) => l('test data'));
  }
}

class Request {
  constructor(options, callback) {
    this.options = options;
    this.callback = callback;
    this.data = {
      writes: [],
      options,
    };
    entries.push(this.data);
    this.response = new Response();
    callback(this.response);
  }

  on() {

  }

  write(data) {
    this.data.writes.push(data);
  }

  end() {
    this.response.run();
  }
}

exports.request = (options, callback) => new Request(options, callback);
