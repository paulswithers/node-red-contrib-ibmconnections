module.exports = function (RED) {

    function ICCommunitiesGet(config) {
        RED.nodes.createNode(this, config);
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        var mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();

        function parseAtomEntry(entry) {
            var xml2js = require("xml2js");
            var builder = new xml2js.Builder({
                rootName: "entry"
            });
            var widget = {};
            if (entry.title && entry.title[0]) {
                widget['title'] = entry.title[0];
            }
            if (entry.link) {
                for (let j = 0; j < entry.link.length; j++) {
                    var tmp = entry.link[j];
                    if (tmp['$'].rel === "self") {
                        widget['ref'] = tmp['$'].href;
                        break;
                    }
                }
            }
            if (entry['snx:widgetDefId']) {
                widget['defId'] = entry['snx:widgetDefId'][0];
            }
            if (entry['snx:widgetInstanceId']) {
                widget['instanceId'] = entry['snx:widgetInstanceId'][0];
            }
            if (entry['snx:hidden']) {
                widget['hidden'] = entry['snx:hidden'][0];
            }
            widget['entry'] = builder.buildObject(entry);
            return widget;
        }
        
        function getWidgetList(theMsg, theURL) {
            node.login.request(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                },
                function (error, response, body) {
                    console.log('getCommunityList: executing on ' + theURL);
                    if (error) {
                        console.log("getCommunityList : error getting information for CommunityList !");
                        node.status({fill: "red", shape: "dot", text: "No CommunityList"});
                        node.error(error.toString(), theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("GET OK (" + response.statusCode + ")");
                            console.log(body);
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill: "red", shape: "dot", text: "Parser Error"});
                                    node.error("Parser Error getCommunityList", theMsg);
                                    return;
                                }
                                var myData = new Array();
                                if (result.feed.entry) {
                                    for (i = 0; i < result.feed.entry.length; i++) {
                                        myData.push(parseAtomEntry(result.feed.entry[i], true));
                                    }
                                    node.status({});
                                } else {
                                    console.log('getCommunityList: No ENTRY found for URL : ' + theURL);
                                    node.status({fill: "red", shape: "dot", text: "No Entry "});
                                }
                                theMsg.payload = myData;
                                node.send(theMsg);
                            });
                        } else {
                            console.log("GET COMMUNITY LIST NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill: "red", shape: "dot", text: "Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            );
        }

        this.on(
            'input',
            function (msg) {
                var serverConfig = RED.nodes.getNode(config.server);
                //
                //  Server is a GLOBAL variable
                //
                var server = serverConfig.getServer;
                var myURL  = server + "/communities/service/atom/community/widgets";
                if (node.login.authType === "oauth") myURL += '/oauth';
                let theCommunity = '';
                let theWidgetId = '';
                let theWidgetDefIds = [];
                let theWidgetQuery = '';
                if (config.communityId != '') {
                    theCommunity = "?communityUuid=" + config.communityId.trim();
                } else if ((msg.communityId != undefined) && (msg.communityId != '')) {
                    theCommunity = "?communityUuid=" + msg.communityId.trim();
                }
                if (config.widgetId != '') {
                    theWidgetId = '&widgetInstanceId="' + config.widgetId.trim() + '"';
                } else if ((msg.widgetId != undefined) && (msg.widgetId != '')) {
                    theWidgetId = '&widgetInstanceId="' + msg.widgetId.trim() + '"';
                }
                if (config.widgetDefIds != '') {
                    theWidgetDefIds = config.widgetDefIds.split(',');
                } else if ((msg.widgetDefIds != undefined) && (msg.widgetDefIds != '')) {
                    theWidgetDefIds = msg.widgetDefIds.split(',');
                }
                for (let k = 0; k < theWidgetDefIds.length; k++) {
                    theWidgetQuery += 'widgetDefId=' + theWidgetDefIds[k].trim();
                }

                node.status({fill: "blue", shape: "dot", text: "Retrieving..."});
                if (theCommunity === '') {
                    //
                    //  There is an issue
                    //
                    console.log("Missing communityId Information");
                    node.status({fill: "red", shape: "dot", text: "Missing communityID"});
                    node.error('Missing communityID', msg);
                } else {
                    myURL += theCommunity;
                    switch (config.target) {
                        case "AllWidgets":
                            getWidgetList(msg, myURL);
                            break;
                        case "ById":
                            if (theWidgetId === '') {
                                //
                                //  There is an issue
                                //
                                console.log("Missing widgetId Information");
                                node.status({fill: "red", shape: "dot", text: "Missing widgetId"});
                                node.error('Missing widgetId', msg);
                            } else {
                                myURL += '&' + theWidgetId;
                                getWidgetList(msg, myURL);
                            }
                            break;
                        case "ByDefIds":
                            if (theWidgetQuery === '') {
                                //
                                //  There is an issue
                                //
                                console.log("Missing widgetDefIds Information");
                                node.status({fill: "red", shape: "dot", text: "Missing widgetDefIds"});
                                node.error('Missing widgetDefIds', msg);
                            } else {
                                myURL += "&" + theWidgetQuery;
                                getWidgetList(msg, myURL);
                            }
                            break;
                    }
                }
            }
        );
    }

    RED.nodes.registerType("ICCommunitiesGet", ICCommunitiesGet);

};