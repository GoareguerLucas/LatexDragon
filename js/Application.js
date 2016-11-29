var loadedScripts = 0, scriptsToLoad = 8;
loadScripts();

//TODO: gameHandler qui s'occupe de DragNDropHandler et MouseClickHandler et cleanup les requetes (bessoin de finir les règles côté serveur d'abord)
//DONE: début de gameHandler, fini timer et notifications

/**
 * Class controlling the different tab of the application.
 * The application is divided in 3 (4 counting the doc) "tab".
 * This class is used to switch between tab and to initialize everything the tabs
 * need in order to run.
 * Can be considered as the "main" object running the application.
 */
class Application {

  /**
   * There can be only one instance of Application, if no instance exist a new one
   * is created, if one instance already exist then it's the one returned.
   */
  constructor () {
    if (!Application.instance) {
      //Reference to electron
      this.remote = require('electron').remote;
      //Application settings
      this.settings = Settings.useDefault();
      //Name of the tab the app is currently on (GAME by default)
      this.currentTab = "GAME";
      //Main dom element who contain the tab content
      this.tabContainer = $(".main");
      //Array containing the app windows (app & doc)
      this.windows = this.remote.getGlobal("windowsArray");
      //Dom element of the spinner used during tab loading
      this.loader = $("<div></div>").addClass("spinner");
      //Json object of the last/current game request to the server
      this.json = null;
      //Id of the client on the server
      this.gameId = null;
      //Id of which formula the game is using
      this.formulaId = null;
      //State of the countdown
      Application.countdown = null;
      //Only instance of Application
      Application.instance = this;
    }

    return Application.instance;
  }

  /**
   * Send a request to get an html file, and change the active tab.
   * Used to get the diffrent html file composing the app "tabs".
   * Call loadHtml() when completed.
   * @param {String} string Name of the request (in this case it's also the name of the tab)
   */
  requestHtml (string) {
    var request = Request.buildRequest(string, this.loadHtml);
    $(".main").html(this.loader);
    request.send();
    this.currentTab = string;
  }

  /**
   * Callback function of the requestHtml request.
   * Load the html file recieved onto the main element.
   * @param {Object} response response from the request (jQuery ajax response)
   * @param {String} status response status from the request
   */
  loadHtml (response, status) {
    if (status != "success")
      Application.getInstance().displayErrorNotification(".main", "Erreur lors du chargment de la page, status : " + status + " (" + response.status + ").")

    var htmlpage = $(response.responseText);
    $(".main").hide();
    $(".main").html("");
    $(".main").append(htmlpage);
    $(".main").fadeIn("800");

    console.log("[CLIENT]: Tab " + Application.getInstance().currentTab + " loaded");

    //Need to use this since in the context when the function is called "this" reference the request object and not the application object
    Application.getInstance().setNavbarActive();
    Application.getInstance().loaded();
  }

  /**
   * Control the active tab of the navbar header.
   * Remove the old active element and set the element with the id string to active.
   */
  setNavbarActive () {
    var id = this.currentTab.toLowerCase();
    $("#" + id).parent().find("li").removeClass("active");
    $("#" + id).addClass("active");
  }

  /**
   * Called when the tab is loaded.
   * Initialize everything the tab need in order to run,
   * also apply the settings to the tab newly loaded.
   */
  loaded () {
    if (this.currentTab == "GAME")
      GameHandler.typesetMath();
    else if (this.currentTab == "SETTINGS") {
      SettingsHandler.setEvents();
      SettingsHandler.setValues();
    }

    this.settings.applySettings();
  }

  /**
   * Return the only instance of Application.
   * @static
   */
  static getInstance () {
    return Application.instance;
  }

  /**
   * Toggle chromium dev tools on the app window.
   */
  toggleConsole() {
    this.windows["app"].webContents.toggleDevTools({mode: 'bottom'});
  }

  /**
   * Send a message/event to the main process to display the documentation
   */
  displayDoc () {
    const {ipcRenderer} = require('electron');
    ipcRenderer.send('display-doc');
  }

  /**
   * Display an error notification.
   * Call displayNotification who handle the creation and display of the
   * notification.
   * @param {String} element identifier of the dom element who will append the notification
   * @param {String} message message to be displayed on the notification
   */
  displayErrorNotification (element, message) {
    this.displayNotification(element, message, "danger");
  }

  /**
   * Display a success notification.
   * Call displayNotification who handle the creation and display of the
   * notification.
   * @param {String} element identifier of the dom element who will append the notification
   * @param {String} message message to be displayed on the notification
   */
  displaySuccessNotification (element, message) {
    this.displayNotification (element, message, "success");
  }

  /**
   * Display a notification.
   * Create the notification of type type and message message and append it to
   * the DOM element element.
   * Create a dismissible notification that won't close unless the user close it.
   * If autoCloseNotif is true the notif will close automatically in notifTimer milliseconds.
   * If a notification was already present in the DOM element it will replace it.
   * @param {String} element identifier of the DOM element who will append the notification
   * @param {String} message message to be displayed on the notification
   * @param {String} type type of the notification (error, success ...) correspond to bootsrap 4 color (danger, warning, success and info)
   */
  displayNotification (element, message, type) {
    $(element).children(".notif").hide("fast", () => {
      $(this).remove();
    });

    var notification = $("<div></div>").addClass("notif").addClass("alert").addClass("alert-" + type).addClass("alert-dismissible").attr("role", "alert").css("display", "none").text(message);
    $("<span></span>").addClass("glyphicon").addClass("glyphicon-remove").attr("aria-hidden", "true").appendTo($("<button></button>").addClass("close").attr("data-dismiss", "alert").appendTo(notification));
    notification.appendTo(element).show("fast");

    if (this.settings.autoCloseNotif)
      setTimeout(() => {
        $(element).children(".notif").hide("fast", () => {
          $(this).remove();
        });
      }, this.settings.notifTimer);
  }

  /**
   * Return the memory usage of this process.
   * Return only the memory usage of the renderer process and not the main process.
   * @returns {Object} memory usage object
   */
  getMemoryUsage () {
    return this.remote.process.getProcessMemoryInfo();
  }

  /**
   * Return the process object (renderer process).
   * @returns {Object} process object
   */
  getProcess () {
    return this.remote.process;
  }
}

/**
 * Called when the document finished loading and is ready.
 * Check if all the scripts have been loaded sucessfully.
 * Request the game html file (By default the app start on the game "tab")
 */
$(document).ready (function () {
  console.log("[CLIENT]: Document ready");
  if (loadedScripts != scriptsToLoad)
      console.log("[CLIENT]: Failed to load all scripts");
  console.log("[CLIENT]: Scripts loading complete (loaded "+loadedScripts+"/"+scriptsToLoad+")");
  var application = new Application();
  application.requestHtml("GAME");
});






function faireOperation () {
  var request = Request.buildRequest("OPERATION", operationResponse);
  request.send("/123456");
}

function operationResponse (response) {
  console.log(response.responseText);
}

/**
 * Load all the needed javascript scripts.
 */
function loadScripts () {
  $.getScript("./js/Request.js").done(function () { loadedScripts++; });
  $.getScript("./js/EnumHelper.js").done(function () { loadedScripts++; });
  $.getScript("./js/MouseClickHandler.js").done(function () { loadedScripts++; });
  $.getScript("./js/Settings.js").done(function () { loadedScripts++; });
  $.getScript("./js/SettingsHandler.js").done(function () { loadedScripts++; });
  $.getScript("./js/DragNDropHandler.js").done(function () { loadedScripts++; });
  $.getScript("./js/GameHandler.js").done(function () { loadedScripts++; });
  $.getScript("./js/Countdown.js").done(function () { loadedScripts++; });
}
