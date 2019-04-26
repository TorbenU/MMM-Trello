/* global Module */

/* Magic Mirror
 * Module: Trello
 *
 * By Joseph Bethge
 * MIT Licensed.
 */

Module.register("MMM-Trello", {

    // Default module config.
    defaults: {
        reloadInterval: 5 * 60 * 1000, // every 10 minutes
        updateInterval: 10 * 1000, // every 10 seconds
        animationSpeed: 2.5 * 1000, // 2.5 seconds
        showTitle: true,
        api_key: "",
        token: "",
        list: "",
        showLineBreaks: false,
        showDueDate: true,
        showDescription: true,
        showChecklists: true,
        showChecklistTitle: false,
        wholeList: false,
        isCompleted: false
    },

    // Define start sequence.
    start: function () {
        Log.info("Starting module: " + this.name);

        moment.locale(this.config.language);

        this.listContent = [];
        this.checklistData = {};

        this.indexActiveCard = 0;

        this.loaded = false;
        this.error = false;
        this.errorMessage = "";
        this.retry = true;

        if (this.config.wholeList === true) {
            this.config.updateInterval = this.config.reloadInterval;
        }

        this.setTrelloConfig();

        this.requestUpdate();
        this.scheduleUpdateRequestInterval();

        this.pause = false;
    },

    /* scheduleVisualUpdateInterval()
     * Schedule visual update.
     */
    scheduleVisualUpdateInterval: function () {
        var self = this;

        self.updateDom(self.config.animationSpeed);

        setInterval(function () {
            if (self.pause) {
                return;
            }
            self.indexActiveCard++;
            self.updateDom(self.config.animationSpeed);
        }, this.config.updateInterval);
    },

    /* scheduleUpdateRequestInterval()
     * Schedule visual update.
     */
    scheduleUpdateRequestInterval: function () {
        var self = this;

        setInterval(function () {
            if (self.pause) {
                return;
            }

            if (self.retry) {
                self.requestUpdate();
            }
        }, this.config.reloadInterval);
    },

    // Define required styles.
    getStyles: function () {
        return ["font-awesome.css", "MMM-Trello.css"];
    },

    // Define required scripts.
    getScripts: function () {
        return ["moment.js"];
    },

    // Override required translations.
    getTranslations: function () {
        return {
            en: "translations/en.json",
            de: "translations/de.json",
            sv: "translations/sv.json",
            pl: "translations/pl.json"
        };
    },

    // Override dom generator.
    getDom: function () {
        var wrapper = document.createElement("div");

        if (this.indexActiveCard >= this.listContent.length) {
            this.indexActiveCard = 0;
        }

        if (this.loaded) {
            // loaded => create DOM
            createDom(wrapper);
        } else {
            // != loaded => show errors
            if (this.error) {
                wrapper.innerHTML = "Please check your config file, an error occured: " + this.errorMessage;
                wrapper.className = "xsmall dimmed";
            } else {
                wrapper.innerHTML = "<span class='small fa fa-refresh fa-spin fa-fw'></span>";
                wrapper.className = "small dimmed";
            }
        }
        return wrapper;
    },

    getWrapperChecklist: function (card) {
        var wrapperChecklist = document.createElement("div");
        wrapperChecklist.className = "checklist-wrapper";
        this.getChecklistDom(wrapperChecklist, card);
        return wrapperChecklist;
    },

    /* getChecklistDom()
     * return the dom for all checklists on current card
     */
    getChecklistDom: function (wrapper, card) {
        const SYMBOL = Object.freeze({
            "incomplete": "fa-square-o",
            "complete": "fa-check-square-o"
        });

        var checklistIDs = this.listContent[card].idChecklists;
        for (var id in checklistIDs) {
            if (checklistIDs[id] in this.checklistData) {
                var checklist = this.checklistData[checklistIDs[id]];
                if (this.config.showChecklistTitle) {
                    var titleElement = document.createElement("div");
                    titleElement.className = "bright medium light";
                    titleElement.innerHTML = checklist.name;
                    wrapper.appendChild(titleElement);
                }

                // Iterate over checklist items
                for (var item in checklist.checkItems) {
                    var itemWrapper = document.createElement("div");
                    itemWrapper.className = "small light checklist-item";

                    var itemSymbol = document.createElement("span");
                    itemSymbol.className = "fa " + SYMBOL[checklist.checkItems[item].state];
                    itemWrapper.appendChild(itemSymbol);

                    var itemName = document.createElement("span");
                    itemName.innerHTML = " " + checklist.checkItems[item].name;
                    itemWrapper.appendChild(itemName);

                    wrapper.appendChild(itemWrapper);
                }
            } else {
                wrapper.innerHTML = "<span class='small fa fa-refresh fa-spin fa-fw'></span>";
                wrapper.className = "small dimmed";
            }
        }
    },
    
    /* setTrelloConfig()
     * intializes trello backend
     */
    setTrelloConfig: function () {
        this.sendSocketNotification("TRELLO_CONFIG", {
            id: this.identifier,
            api_key: this.config.api_key,
            token: this.config.token
        });
    },

    /* requestUpdate()
    * request a list content update
     */
    requestUpdate: function () {
        this.sendSocketNotification("REQUEST_LIST_CONTENT", {list: this.config.list, id: this.identifier});
    },

    notificationReceived: function (notification, payload, sender) {
        if (notification === "USER_PRESENCE") {
            if (payload === true) {
                return !payload;
            }
            return true;
        }
    },

    // Override socket notification handler.
    socketNotificationReceived: function (notification, payload) {
        console.log(payload);

        if (payload.id !== this.identifier) {
            // not for this module
            return;
        }

        if (notification === "TRELLO_ERROR") {
            this.errorMessage = "Error " + payload.error.statusCode + "(" + payload.error.statusMessage + "): " + payload.error.responseBody;
            Log.error(this.errorMessage);

            this.error = true;
            this.retry = false;

            this.updateDom(this.config.animationSpeed);
        }
        if (notification === "LIST_CONTENT") {
            this.error = false;

            this.listContent = payload.data;

            if (!this.loaded) {
                this.loaded = true;
                this.scheduleVisualUpdateInterval();
            }
        }
        if (notification === "CHECK_LIST_CONTENT") {
            this.checklistData[payload.data.id] = payload.data;
        }
    }
});

function createDom(wrapper) {
    if (this.listContent.length === 0) {
        wrapper.innerHTML = this.translate("NO_CARDS");
        wrapper.className = "small dimmed";
    }
    else {
        var content, 
            i, 
            start = 0, 
            end = this.listContent.length;

        if (!this.config.wholeList) {
            // Only create the dom for the active card
            start = this.indexActiveCard;
            end = this.indexActiveCard;
        }
        
        for (i = start; i < end; i++) {
            var wrapperCardContent = document.createElement("div");
            wrapperCardContent.className = "medium light " + (this.config.isCompleted ? "is-completed" : "bright");

            // get content title
            if (this.config.showTitle) {
                title = this.config.showTitle ? getTitle(i) : "";
            }

            var dueDate = "";
            if (this.config.showDueDate && this.listContent[i].due) {
                dueDate = moment(this.listContent[i].due).fromNow()
            }
            
            content += title + "(" + dueDate + ")"

            wrapperCardContent.innerHTML = content;
            wrapper.appendChild(wrapperCardContent);

            if (this.config.showDescription) {
                var wrapperCardDescription;
                ({ wrapperCardDescription, name } = getWrapperCardDescription(name, i));
                wrapper.appendChild(wrapperCardDescription);
            }
            if (this.config.showChecklists) {
                wrapper.appendChild(getElementChecklist(i));
            }
        }
    }
}

function getTitle(card) {
        return this.listContent[card].name;
}

function getWrapperCardDescription(content, card) {
    var wrapperCardDescription = document.createElement("div");
    wrapperCardDescription.className = "small light " + (this.config.isCompleted ? "is-completed dimmed" : "");
    content = this.listContent[card].desc;
    if (this.config.showLineBreaks) {
        var lines = content.split('\n');
        for (var i in lines) {
            var lineElement = document.createElement("div");
            lineElement.innerHTML = lines[i];
            wrapperCardDescription.appendChild(lineElement);
        }
    }
    else {
        wrapperCardDescription.innerHTML = content;
    }
    return { wrapperCardDescription, content };
}


