const Table = require("@saltcorn/data/models/table");
const db = require("@saltcorn/data/db");
const { mkWhere } = require("@saltcorn/db-common/internal");

const get_where_vals = (table_name, whereFull) => {
  if (whereFull?._fts?.fields) {
    whereFull._fts.fields = whereFull?._fts?.fields.filter(
      (f) => f.name !== "_version_id" && f.name !== "_deleted"
    );
  }

  const schemaPrefix = db.getTenantSchemaPrefix();
  const { _is_latest, _deleted, ...whereRest } = whereFull;

  let { where, values } = mkWhere(whereRest || {});
  where = where.replaceAll('"_version_id"', "(_version || '_' || id)");
  if (_is_latest) {
    where = `${
      where ? where + " and" : "where"
    } h._version = (select max(ih._version) from ${schemaPrefix}"${db.sqlsanitize(
      table_name
    )}__history" ih where ih.id = h.id)`;
  }
  if (_deleted === false || _deleted === "false")
    where = `${
      where ? where + " and " : "where"
    } exists(select id from ${schemaPrefix}"${db.sqlsanitize(
      table_name
    )}" t where t.id = h.id)`;
  else if (_deleted)
    where = `${
      where ? where + " and " : "where"
    } not exists(select id from ${schemaPrefix}"${db.sqlsanitize(
      table_name
    )}" t where t.id = h.id)`;

  return { where, values };
};

const runQuery = async (table, whereFull) => {
  const schemaPrefix = db.getTenantSchemaPrefix();
  const { where, values } = get_where_vals(table.name, whereFull);
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

const updateRow = async (table_name, update_in, version_id) => {
  const { _version_id, _is_latest, _deleted, ...update } = update_in;
  const schemaPrefix = db.getTenantSchemaPrefix();
  const sqlParts = [],
    values = [];
  const nkeys = Object.keys(update).length;
  const [version, id] = version_id.split("_");
  Object.entries(update).forEach(([k, v], ix) => {
    sqlParts.push(`"${db.sqlsanitize(k)}"=$${ix + 1}`);
    values.push(v);
  });
  values.push(version);
  values.push(id);
  const sql = `update ${schemaPrefix}"${db.sqlsanitize(
    table_name
  )}__history" SET ${sqlParts.join()} where _version = $${
    nkeys + 1
  } and id = $${nkeys + 2}`;
  await db.query(sql, values);
  return {};
};

const insertRow = async (table, rec_in) => {
  const { _is_latest, _deleted, _version_id, ...rec } = rec_in;
  const kvs = Object.entries(rec);
  const fnameList = kvs.map(([k, v]) => `"${db.sqlsanitize(k)}"`).join();
  var valPosList = [];
  var valList = [];
  const schemaPrefix = db.getTenantSchemaPrefix();

  kvs.forEach(([k, v]) => {
    valList.push(v);
    valPosList.push(`$${valList.length}`);
  });
  const sql =
    valPosList.length > 0
      ? `insert into ${schemaPrefix}"${db.sqlsanitize(
          table.name
        )}__history"(${fnameList}) values(${valPosList.join()}) returning "${
          table.pk_name || "id"
        }"`
      : `insert into ${schemaPrefix}"${db.sqlsanitize(
          table.name
        )}" DEFAULT VALUES returning "${table.pk_name || "id"}"`;
  const { rows } = await db.query(sql, valList);
  return rows[0][table.pk_name || "id"];
};

const countRows = async (table_name, whereFull) => {
  const schemaPrefix = db.getTenantSchemaPrefix();
  const { where, values } = get_where_vals(table_name, whereFull);
  const sql = `select count(*) from ${schemaPrefix}"${db.sqlsanitize(
    table_name
  )}__history" h ${where.length ? ` ${where}` : ""}`;
  const { rows } = await db.query(sql, values);
  console.log(rows);
  return +rows?.[0]?.count;
};

const deleteRows = async (table_name, whereFull) => {
  const schemaPrefix = db.getTenantSchemaPrefix();
  const { where, values } = get_where_vals(table_name, whereFull);
  const sql = `delete from ${schemaPrefix}"${db.sqlsanitize(
    table_name
  )}__history" h ${where.length ? ` ${where}` : ""}`;
  await db.query(sql, values);
};

const distinctValues = async (table_name, fieldnm, whereObj) => {
  const schemaPrefix = db.getTenantSchemaPrefix();

  if (whereObj) {
    const { where, values } = mkWhere(whereObj, db.isSQLite);
    const res = await db.query(
      `select distinct "${db.sqlsanitize(
        fieldnm
      )}" from ${schemaPrefix}"${db.sqlsanitize(
        table_name
      )}__history" ${where} order by "${db.sqlsanitize(fieldnm)}"`,
      values
    );
    return res.rows.map((r) => r[fieldnm]);
  } else {
    const res = await db.query(
      `select distinct "${db.sqlsanitize(
        fieldnm
      )}" from ${schemaPrefix}"${db.sqlsanitize(
        table_name
      )}__history" order by "${db.sqlsanitize(fieldnm)}"`
    );
    return res.rows.map((r) => r[fieldnm]);
  }
};

module.exports = {
  runQuery,
  countRows,
  deleteRows,
  updateRow,
  insertRow,
  distinctValues,
};
