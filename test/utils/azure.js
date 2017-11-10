let data = [];

const cleanup = (obj) => obj ? Object.keys(obj).reduce((output, i) => {
  output[i] = obj[i]._;
  return output;
}, {}) : undefined;

class TableStorage {
  createTableIfNotExists(tableName, callback) {
    callback();
  }

  insertEntity(tableName, entry, callback) {
    data.push(entry);
    callback();
  }

  replaceEntity(tableName, entry, callback) {
    data = data.map(d => {
      if (d.PartitionKey._ === entry.PartitionKey._ && d.RowKey._ === entry.RowKey._) {
        return entry;
      } else {
        return d;
      }
    });
    callback();
  }

  retrieveEntity(tablename, partitionKey, rowKey, callback) {
    callback(undefined, cleanup(data.find(d => d.PartitionKey._ === partitionKey && d.RowKey._ === rowKey)));
  }
}

exports.getData = () => data;

exports.createTableService = () => new TableStorage();
