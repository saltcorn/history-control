const db = require("@saltcorn/data/db");
const { eval_expression } = require("@saltcorn/data/models/expression");
const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const { getState } = require("@saltcorn/data/db/state");
const { mkTable } = require("@saltcorn/markup");
const { pre, code } = require("@saltcorn/markup/tags");

const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: "query",
        form: async () => {
          const tables = await Table.find({ versioned: true });
          return new Form({
            fields: [
              {
                name: "table",
                label: "Table",
                type: "String",
                required: true,
                attributes: {
                  options: tables.map((t) => t.name),
                },
                sublabel: "Select a versioned table",
              },
            ],
          });
        },
      },
    ],
  });
const runQuery = async (cfg, where, opts) => {
  const table = Table.findOne({ name: cfg.table });
  const wheres = [];
  let phIndex = 1;
  const phValues = [];

  for (const k of Object.keys(where)) {
    if (k === "_latest") {
      wheres.push(`_is_latest = `);
      continue;
    }
    const f = table.getField(k);
    if (f) {
      wheres.push(`"${k}" = $${phIndex}`);
      phValues.push(where[k]);
      phIndex += 1;
    }
  }
  const schemaPrefix = db.getTenantSchemaPrefix();

  const sql = `select 
  _version || '_'|| id as _version_id, 
  _version = (select max(ih._version) from ${schemaPrefix}"${db.sqlsanitize(
    table.name
  )}__history" ih where ih.id = h.id) as _is_latest,
  not exists(select id from ${schemaPrefix}"${db.sqlsanitize(
    table.name
  )}" t where t.id = h.id) as _deleted, 
  * from ${schemaPrefix}"${db.sqlsanitize(table.name)}__history" h`;

  return await db.query(sql, phValues);
};
module.exports = {
  "History for database table": {
    configuration_workflow,
    fields: (cfg) => {
      if (!cfg?.table) return [];

      const table = Table.findOne({ name: cfg.table });
      return [
        { name: "_version_id", type: "String", primary_key: true },
        ...table.fields.map((f) => {
          f.primary_key = false;
          f.validator = undefined;
          if (f.is_fkey) f.type = "Integer";
          else f.type = f.type?.name || f.type;
          return f;
        }),
        { name: "_version", label: "Version", type: "Integer" },
        { name: "_is_latest", label: "Is latest", type: "Bool" },
        { name: "_deleted", label: "Deleted", type: "Bool" },

        //_version
        //_time
        //_restore_of_version
        //_userid
        //_deleted
        //
      ];
    },
    get_table: (cfg) => {
      return {
        getRows: async (where, opts) => {
          const qres = await runQuery(cfg, where, opts);
          return qres.rows;
        },
      };
    },
  },
};
