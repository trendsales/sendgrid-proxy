let data = [];

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
      if (d.partitionKey._ === entry.partitionKey._ && d.rowKey._ === entry.rowKey._) {
        return entry;
      } else {
        return d;
      }
    });
    callback();
  }

  retrieveEntity(tablename, partitionKey, rowKey, callback) {
    callback(data.find(d => d.partitionKey._ === entry.partitionKey._ && d.rowKey._ === entry.rowKey._));
  }
}

exports.getData = () => data;

exports.createTableService = () => new TableStorage();
