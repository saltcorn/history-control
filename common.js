const Table = require("@saltcorn/data/models/table");
const db = require("@saltcorn/data/db");
const { mkWhere } = require("@saltcorn/db-common/internal");

const runQuery = async (table, whereFull) => {
  if (whereFull?._fts?.fields) {
    whereFull._fts.fields = whereFull?._fts?.fields.filter(
      (f) => f.name !== "_version_id" && f.name !== "_deleted"
    );
  }

  const schemaPrefix = db.getTenantSchemaPrefix();
  const { _is_latest, _deleted, ...whereRest } = whereFull;

  let { where, values } = mkWhere(whereRest || {});

  if (_is_latest) {
    where = `${
      where ? where + " and" : "where"
    } h._version = (select max(ih._version) from ${schemaPrefix}"${db.sqlsanitize(
      table.name
    )}__history" ih where ih.id = h.id)`;
  }
  if (_deleted === false || _deleted === "false")
    where = `${
      where ? where + " and " : "where"
    } exists(select id from ${schemaPrefix}"${db.sqlsanitize(
      table.name
    )}" t where t.id = h.id)`;
  else if (_deleted)
    where = `${
      where ? where + " and " : "where"
    } not exists(select id from ${schemaPrefix}"${db.sqlsanitize(
      table.name
    )}" t where t.id = h.id)`;

  const sql = `select 
 _version || '_'|| id as _version_id, 
 _version = (select max(ih._version) from ${schemaPrefix}"${db.sqlsanitize(
    table.name
  )}__history" ih where ih.id = h.id) as _is_latest,
 not exists(select id from ${schemaPrefix}"${db.sqlsanitize(
    table.name
  )}" t where t.id = h.id) as _deleted, 
 * from ${schemaPrefix}"${db.sqlsanitize(table.name)}__history" h ${
    where.length ? ` ${where}` : ""
  }`;
  return await db.query(sql, values);
};

module.exports = { runQuery };
