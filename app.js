const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`Server running at http//localhost:3000`);
    });
  } catch (e) {
    console.log(`Db Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

// POST login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `select * from user where username='${username}';`;
  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwt_token = jwt.sign(payload, "random");
      response.send({ jwt_token });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//toCamelCase states
const toCamelCaseState = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

//toCamelCase district
const toCamelCaseDistrict = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//middleware authenticateToken
const authenticateToken = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwt_token = authHeader.split(" ")[1];
    if (jwt_token === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwt_token, "random", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      });
    }
  } else {
    response.status(400);
    response.send("No authorization header found");
  }
};

//Get Users API
app.get("/users/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUsersQuery = `select * from district`; // where username='${username}';`;
  const usersArray = await db.all(getUsersQuery);
  //   response.send(usersArray);
  const newDistrictsArray = usersArray.map((eachDistrict) =>
    toCamelCaseDistrict(eachDistrict)
  );
  response.send(newDistrictsArray);
});

//Get states API
app.get("/states/", authenticateToken, async (request, response) => {
  //   const { username } = request;
  const getStatesQuery = `select * from state`; // where username='${username}';`;
  const statesArray = await db.all(getStatesQuery);
  const newStatesArray = statesArray.map((eachState) =>
    toCamelCaseState(eachState)
  );
  response.send(newStatesArray);
});

//get stAte API
app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `select * from state where state_id=${stateId};`;
  const state = await db.get(getStateQuery);
  response.send(toCamelCaseState(state));
});

//create district /districts/
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `insert into district
  (district_name,state_id,cases,cured,active,deaths)
  values('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const res = await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//5. get district API /districts/:districtId/
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `select * from district where district_id=${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(toCamelCaseDistrict(district));
  }
);

//6. delete API /districts/:districtId/
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `delete from district where district_id='${districtId}';`;
    const res = await db.run(deleteDistrictQuery);
    response.send(`District Removed`);
  }
);

//7. PUT API /districts/:districtId/
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const districtDetails = request.body;
      const {
        districtName,
        stateId,
        cases,
        cured,
        active,
        deaths,
      } = districtDetails;
      //   console.log(districtDetails);
      const updateDistrictQuery = `update district set district_name = '${districtName}', state_id = ${stateId}, cases = ${cases}, cured = ${cured}, active = ${active}, deaths = ${deaths} where district_id=${districtId};`;
      const res = await db.run(updateDistrictQuery);
      response.send(`District Details Updated`);
    } catch (e) {
      console.log(`Db Error : ${e.message}`);
      //   process.exit(1);
    }
  }
);

//8.Get API /states/:stateId/stats/
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `select sum(cases) as totalCases, sum(cured) as totalCured, sum(active) as totalActive, sum(deaths) as totalDeaths from district where state_id=${stateId};`;
    const res = await db.get(getStatsQuery);
    response.send(res);
  }
);

module.exports = app;
