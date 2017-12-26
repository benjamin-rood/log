
let Log = window.Log || {}
Log.console = {
  history: [],

  startOp: ['start', 'begin'],
  stopOp: ['stop', 'end', 'pause'],
  resumeOp: ['resume', 'continue'],
  addOp: ['add', 'continue'],
  possibleOperations: [...Log.console.startOp, ...Log.console.stopOp, ...Log.console.resumeOp, ...Log.console.addOp, 'edit', 'delete', 'set', 'import', 'export', 'rename', 'invert'],

  /**
   * @typedef {Object} Command
   * @property {string} operation - The user-specified command to perform.
   * @property {string[]} args - Array of string arguments for the operation.
   */

  /**
   * Returns raw user input string into command object.
   *
   * Valid user command grammar (EBNF form):
   *
   * <command> := <operation> { <arg> }
   * <operation> := <start> | <stop> | <resume> | <add> | "edit" | "delete" |
   *                "set" | "import" | "export" | "rename" | "invert"
   * <start> := "start" | "begin"
   * <stop> := "stop" | "end" | "pause"
   * <resume> := "resume" | "continue"
   * <add> := "add" | "new"
   * <arg> := <quote> <word> { <word> } <quote>
   * <quote> := '"'
   * <word> := <character> { <character> }
   * <character> := <letter> | <digit> | <symbol>
   *
   * Any improperly-formatted commands are discarded and ignored.
   *
   * @param {string} str - Raw input from user.
   * @returns {?Command} If initial word in <str> is valid, else {null}.
    */
  parseCmd (str) {
    const operation = str.split(' ', 1)[0].toLowerCase()
    if (!Log.console.possibleOperations.includes(operation)) { return } // reject/ignore

    let quotedArgs = (str) => {
      let args = []
      let quoteStart = false
      let arg = ''
      // iterate through chars in string, breaking into quote-wrapped cmd args,
      // skipping quotes and whitespace between quoted blocks as we go.
      for (let ch of str) {
        if (ch === '"') {
          if (!quoteStart) quoteStart = true  // begin arg wrapped in quotes
          else {
            quoteStart = false                // end of arg wrapped in quotes
            args.push(arg)                    // add argument to array of args
            arg = ''                          // reset
          }
        } else {
          if (quoteStart) arg += ch           // skip whitespace between args
        }
      }
      return args
    }

    const args = quotedArgs(str)
    const command = {operation: operation, args: args}
    return command
  },

  /**
   * Execute the parsed command instruction from the user
   * @param {Object} cmd - Data structure of parsed user log instruction.
   * @param {string} cmd.operation - The operation to execute.
   * @param {string[]} cmd.args - The arguments to be passed to the operation.
   */
  executeCmd (cmd) {
    switch (true) {
      case cmd.operation in Log.startOp:
        {
          const sect = cmd.args[0]
          const proj = cmd.args[1]
          const desc = cmd.args[2]
          Log.console.startLog(sect, proj, desc)
        }
        break
      case cmd.operation in Log.stopOp:
        Log.console.endLog()
        break
      case cmd.operation in Log.resumeOp:
        Log.console.resume()
        break
      case cmd.operation in Log.addOp:
        {
          const sect = cmd.args[0]
          const proj = cmd.args[1]
          const desc = cmd.args[2]
          const start = cmd.args[3]
          const end = cmd.args[4]
          Log.console.addLog(sect, proj, desc, start, end)
        }
        break
      case 'edit':
        {
          const id = Number(cmd.args[0]) - 1
          const attr = cmd.args[1].toLowerCase()
          const value = cmd.args[2]
          Log.console.edit(id, attr, value)
        }
        break
      case 'delete':
        {
          const id = Number(cmd.args[0]) - 1
          Log.console.delete(id)
        }
        break
      case 'set':
        // set ignores all but the first two arguments
        {
          const attr = cmd.args[0].toLowerCase()
          const value = cmd.args[1]
          Log.console.set(attr, value)
        }
        break
      case 'import':
        Log.console.importUser()
        break
      case 'export':
        Log.console.exportUser()
        break
      case 'rename':
        {
          const category = cmd.args[0]
          const oldName = cmd.args[1]
          const newName = cmd.args[2]
          Log.console.rename(category, oldName, newName)
        }
        break
      case 'invert':
        Log.console.invert()
        break
    }
  },

  /**
   * Import user data
   */
  importUser () {
    let path = dialog.showOpenDialog({properties: ['openFile']})

    if (!path) return

    let string = ''

    try {
      string = fs.readFileSync(path[0], 'utf-8')
    } catch (e) {
      window.Notification('An error occured while trying to load this file.')
    }

    localStorage.setItem('user', string)
    user = JSON.parse(localStorage.getItem('user'))

    window.Notification('Your log data was successfully imported.')

    Log.refresh()
  },

  /**
   * Export user data
   */
  exportUser () {
    let data = JSON.stringify(JSON.parse(localStorage.getItem('user')))

    dialog.showSaveDialog((fileName) => {
      if (fileName === undefined) return
      fs.writeFile(fileName, data, (err) => {
        if (err) {
          window.Notification(`An error occured creating the file ${err.message}`)
        } else {
          window.Notification('Your log data has been exported.')
        }
      })
    })
  },

  /**
   * Start a log entry
   * @param {string} sect - Sector label.
   * @param {string} proj - Project label.
   * @param {string} desc - Description of activity.
   */
  startLog (sect, proj, desc) {
    if (user.log.length !== 0 && user.log.slice(-1)[0].e === 'undefined') return

    let start = Log.time.toHex(new Date())

    user.log.push({
      s: start,
      e: 'undefined',
      c: sect,
      t: proj,
      d: desc
    })

    window.Notification(`Log started: ${sect} - ${proj} - ${desc}`)

    Log.options.update()
  },

  /**
   * Add log entry manually
   * @param {string} sect - Sector label.
   * @param {string} proj - Project label.
   * @param {string} desc - Description of activity.
   # @param {string} start - Timestamp-formatted string of activity start time.
   # @param {string} end - Timestamp-formatted string of activity end time.
   */
  addLog (sect, proj, desc, start, end) {
    user.log.push({
      s: Log.time.convertDateTime(start),
      e: Log.time.convertDateTime(end),
      c: sect,
      t: proj,
      d: desc
    })

    window.Notification(`Log added: ${sect} - ${proj} - ${desc}`)

    Log.options.update()
  },

  /**
   * End a log entry
   */
  endLog () {
    let last = user.log.slice(-1)[0]
    if (last.e !== 'undefined') return
    last.e = Log.time.toHex(new Date())
    clearInterval(timer)

    window.Notification(`Log ended: ${last.c} - ${last.t} - ${last.d}`)

    Log.options.update()
  },

  /**
   * Resume a paused log entry
   * @param {Number} id - Row identifier for log entry.
   *  (default id = -1, i.e. resume the last log entry)
   */
  resume (id = -1) {
    let entry = user.log.slice(id)[0]

    if (entry.e === 'undefined') return

    user.log.push({
      s: Log.time.toHex(new Date()),
      e: 'undefined',
      c: entry.c,
      t: entry.t,
      d: entry.d
    })

    window.Notification(`Log resumed: ${entry.c} - ${entry.t} - ${entry.d}`)

    Log.options.update()
  },

  /**
   * Set a config attribute
   * @param {string} attr - The config attribute to modify.
   * @param {string} value - The value the config attribute will be set to.
   */
  set (attr, value) {
    if (attr === 'background' || attr === 'bg') {
      Log.options.setBG(value)
    } else if (attr === 'color' || attr === 'colour' || attr === 'text') {
      Log.options.setColour(value)
    } else if (attr === 'highlight' || attr === 'accent') {
      Log.options.setAccent(value)
    } else if (attr === 'font' || attr === 'typeface' || attr === 'type') {
      Log.options.setFont(value)
    } else if (attr === 'view') {
      Log.options.setView(value)
    } else if (attr === 'cal' || attr === 'calendar') {
      Log.options.setCalendar(value)
    } else if (attr === 'timeformat' || attr === 'time') {
      Log.options.setTimeFormat(value)
    } else if (attr === 'dateformat' || attr === 'date') {
      Log.options.setDateFormat(value)
    } else if (attr === 'weekstart') {
      Log.options.setWeekStart(value)
    } else if (attr === 'category' || attr === 'sector' || attr === 'cat' || attr === 'sec') {
      Log.options.setColourCode(value)
    } else if (attr === 'project' || attr === 'pro') {
      Log.options.setProjectColourCode(value)
    } else if (attr === 'colourmode' || attr === 'colormode') {
      Log.options.setColourMode(value)
    }
  },

  /**
   * Delete a log
   * @param {Number} id - ID key of log entry to remove from user JSON.
   */
  delete (id) {
    user.log.splice(id - 1, 1)
    Log.options.update()
  },

  /**
   * Edit a log
   * @param {Number} id - ID key of log entry to modify.
   * @param {string} attr - The name of the log attribute to modify.
   * @param {string} value - The value to give the specified log attribute.
   */
  edit (id, attr, value) {
    if (attr === 'sec' || attr === 'sector') {
      user.log[id].c = value
    } else if (attr === 'title' || attr === 'pro' || attr === 'project') {
      user.log[id].t = value
    } else if (attr === 'desc' || attr === 'dsc' || attr === 'description') {
      user.log[id].d = value
    } else if (attr === 'start') {
      user.log[id].s = Log.time.convertDateTime(value)
    } else if (attr === 'end') {
      user.log[id].e = Log.time.convertDateTime(value)
    } else return

    Log.options.update()
  },

  /**
   * Rename a sector or project
   * @param {string} category - Either 'sector' or 'project'.
   * @param {string} oldName - Current label string for sector/project.
   * @param {string} newName - New label string for sector/project.
   */
  rename (category, oldName, newName) {
    // Ignore bad input values
    if (!(category in ['sector', 'sec', 'project', 'pro'])) return

    let notFound = category => {
      let message = category === 'sector' ? `The sector "${oldName}" does not exist in your logs.` : `The project "${oldName}" does not exist in your logs.`
      window.Notification(message)
    }

    if (category === 'sector' || category === 'sec') {
      if (Log.data.getEntriesBySector(oldName).length === 0) {
        notFound('sector')
        return
      }
      for (let i = 0, l = user.log.length; i < l; i++) {
        if (user.log[i].c === oldName) {
          user.log[i].c = newName
        }
      }
    } else if (category === 'project' || category === 'pro') {
      if (Log.data.getEntriesByProject(oldName).length === 0) {
        notFound('project')
        return
      }
      for (let i = 0, l = user.log.length; i < l; i++) {
        if (user.log[i].t === oldName) {
          user.log[i].t = newName
        }
      }
    } else return

    window.Notification(`The sector "${oldName}" has been renamed to "${newName}."`)

    Log.options.update()
  },

  /**
   * Invert interface colours
   */
  invert () {
    let bg = user.config.ui.bg
    let c = user.config.ui.colour

    user.config.ui.bg = c
    user.config.ui.colour = bg

    Log.options.update()
  }
}
