let data = [];

class TableStorage {
  createTableIfNotExists(tableName, callback) {
    callback();
  }

  insertOrReplaceEntity(tableName, entity, callback) {
    this.retrieveEntity(tableName, entity.PartitionKey._, entity.RowKey._, (err, prev) => {
      if (prev) {
        this.replaceEntity(tableName, entity, callback);
      } else {
        this.insertEntity(tableName, entity, callback);
      }
    })
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
    callback(undefined, data.find(d => d.PartitionKey._ === partitionKey && d.RowKey._ === rowKey));
  }
}

exports.getData = () => data;

exports.createTableService = () => new TableStorage();
