// TODO
// 1. Get tournaments from start.gg API and insert/update sheet rows
// 2. Add JSDoc and general comments
// 3. Split sheets by tournament location (US state and then country)
// 4. Archive or delete past data

function updateTournamentListing() {
  const properties = PropertiesService.getScriptProperties()
  let pageNumber = Number(properties.getProperty("pageNumber"))
  while (pageNumber) {
    const state = "AZ"
    const tournamentObjects = getTournamentsByPageAndState(pageNumber, state)
    const dataRows = getDataRows(tournamentObjects)
    insertSheetDataRows(dataRows, state)
  }
  properties.setProperty("pageNumber", pageNumber)
}

function getTournamentsByPageAndState(pageNumber, state) {
  // Query upcoming tournaments and events
  const tournamentsByState = `
    query TournamentsByState(\$page: Int = 1, \$perPage: Int = 10, \$state: String, \$startAt: Timestamp!) {
      tournaments(query: {
        page: \$page
        perPage: \$perPage
        filter: {
          addrState: \$state
          afterDate: \$startAt
        }
      }) {
        nodes {
          id
          slug
          name
          startAt
          events {
            id
            slug
            startAt
            name
            numEntrants
            videogame {
              id
              name
            }
          }
        }
      }
    }
  `
  const formData = {
    "operationName": "TournamentsByState",
    "query": tournamentsByState,
    "variables": JSON.stringify({
      page: pageNumber,
      perPage: 10,
      state: state,
      startAt: Math.floor(new Date().getTime() / 1000)
    })
  }
  const apiKey = PropertiesService.getScriptProperties().getProperty("apiKey")
  const headers = {
    "Authorization": `Bearer ${apiKey}`
  }
  const options = {
    "method": "POST",
    "headers": headers,
    "payload": formData
  }
  const url = "https://api.start.gg/gql/alpha"
  const response = UrlFetchApp.fetch(url, options)
  const json = JSON.parse(response.getContentText())
  return json.data.tournaments
}

function getDataRows(tournamentObjects) {
  const dataRows = []
  tournamentObjects.nodes.forEach(tournament => {
    const startGgUrl = "https://www.start.gg/"
    const tournamentUrl = startGgUrl + tournament.slug
    console.log(`TOURNAMENT: ${tournament.name} (${tournamentUrl})`)
    if (tournament.events === null) {
      console.log("No listed events")
      return
    }
    tournament.events.forEach(event => {
      const eventUrl = startGgUrl + event.slug
      console.log(`EVENT: ${event.videogame.name}`)
      const eventDataForSheetRow = {
        "date": new Date(event.startAt * 1000),
        "name": `${tournament.name}: ${event.name}`,
        "game": event.videogame.name,
        "url": eventUrl,
      }
      dataRows.push(Object.values(eventDataForSheetRow))
    })
  })
  return dataRows
}

function insertSheetDataRows(dataRows, sheetName) {
  const spreadsheet = SpreadsheetApp.openById("1AIMZepfkEIUmTYFgFY4t4wTQSXrP_YvETAB-WAwyCyM")
  const sheet = spreadsheet.getSheetByName(sheetName)
  const rowCount = dataRows.length
  const columnCount = dataRows[0].length
  console.log(`Inserting ${rowCount} rows into sheet "${sheetName}"`)
  sheet.insertRowsBefore(2, rowCount)
  sheet.getRange(2, 1, rowCount, columnCount).setValues(dataRows)
  sheet.setFrozenRows(1)
  sheet.sort(1, false)
}
