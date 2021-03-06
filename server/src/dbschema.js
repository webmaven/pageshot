const db = require("./db");
const Keygrip = require('keygrip');
const pgpatcher = require("pg-patcher");
const path = require("path");

const MAX_DB_LEVEL = 7;

/** Create all the tables */
exports.createTables = function () {
  console.info("Setting up tables on", db.constr);
  return db.getConnection().then(([conn, done]) => {
    // This is assuming we are running from dist/server/dbschema.js, and need to
    // find the path of server/db-patches/ (not dist):
    let dirname = path.join(__dirname, "..", "..", "server", "db-patches");
    return new Promise((resolve, reject) => {
      pgpatcher(conn, MAX_DB_LEVEL, {dir: dirname}, function(err) {
        if (err) {
          console.error(`Error patching database to level ${MAX_DB_LEVEL}!`, err);
          done();
          reject(err);
        } else {
          console.info(`Database is now at level ${MAX_DB_LEVEL}`);
          resolve();
        }
      });
    });
  }).then(() => {
    let newId = "tmp" + Date.now();
    return db.insert(
      `INSERT INTO data (id, deviceid, value, url)
       VALUES ($1, NULL, $2, $3)`,
      [newId, "test value", ""]
    ).then((inserted) => {
      if (! inserted) {
        throw new Error("Could not insert");
      }
      return db.del(
        `DELETE FROM data
         WHERE id = $1`,
        [newId]
      ).then((count) => {
        if (count != 1) {
          throw new Error("Should have deleted one row");
        }
      });
    });
  }).catch((err) => {
    if (err.code === "ECONNREFUSED") {
      console.warn(`Could not connect to database on ${db.constr}`);
    }
    console.warn("Got error creating and testing tables:", err);
  });
};

let keys;
let textKeys;

exports.getKeygrip = function () {
  return keys;
};

exports.getTextKeys = function () {
  return textKeys;
};

/** Loads the random signing key from the database, or generates a new key
    if none are found */
function loadKeys() {
  return db.select(
    `SELECT key FROM signing_keys ORDER BY CREATED`,
    []
  ).then((rows) => {
    if (rows.length) {
      let textKeys = [];
      for (let i=0; i<rows.length; i++) {
        textKeys.push(rows[i].key);
      }
      return textKeys;
    } else {
      return makeKey().then((key) => {
        return db.insert(
          `INSERT INTO signing_keys (created, key)
           VALUES (NOW(), $1)`,
          [key]
        ).then((ok) => {
          if (! ok) {
            throw new Error("Could not insert key");
          }
          return [key];
        });
      });
    }
  });
}

exports.createKeygrip = function () {
  loadKeys().then((fetchedTextKeys) => {
    textKeys = fetchedTextKeys;
    keys = new Keygrip(textKeys);
  }).catch((err) => {
    console.warn("Could not create signing keys:", err);
  });
};



/** Returns a promise that generates a new largish ASCII random key */
function makeKey() {
  return new Promise(function (resolve, reject) {
    require('crypto').randomBytes(48, function(err, buf) {
      if (err) {
        reject(err);
        return;
      }
      resolve(buf.toString('base64'));
    });
  });
}
