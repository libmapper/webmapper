class MapProperties {
  constructor(container, graph, view) {
    this.container = container;
    this.graph = graph;
    this.view = view;
    this.mapProtocols = ["UDP", "TCP"];

    $(this.container).append(
      "<div' id='menu-bar' class='topMenu' style='width:25px;'>" +
        "<div id='curveButton' style='width:20px;height:100%'>" +
        "<div>" +
        "<div id='curveTitle' class='topMenuTitle half'><strong>CURVE</strong></div>" +
        "</div>" +
        "<div id='exprButton' style='width:20px;height:68px'>" +
        "<div id='exprTitle' class='topMenuTitle half' style='top:53px'><strong>EXPR</strong></div>" +
        "</div>" +
        "</div>" +
        "</div>"
    );

    $("#menu-bar").after(
      "<button id='exprUpdate' disabled='true'>Update Expression</button>"
    );
    $("#menu-bar").after("<div id='editor'></div>");

    /*
      Set up the CodeMirror Editor in the next few lines
    */
    this.editor = CodeMirror(document.querySelector("#editor"), {
      lineNumbers: true,
      tabSize: 2,
      theme: "material-darker",
      value: "",
    });
    /*
      Handle click into codeMirror to ensure other key-bindings do not interfere
    */
    this.editor.on("mousedown", () => {
      console.log("Mouse Down");
      this.view.isCodeMirror = true;
    });

    this.cachedProperty = { key: null, value: null };
    this._addHandlers();
  }

  _addHandlers() {
    var self = this;
    var counter = 0;

    $(document).click(function (event) {
      var $target = $(event.target);
      if ($("#exprUpdate").is($target)) {
        // Ensure that clicking the `update expression` button does not trigger an exit of CodeMirror
        return;
      }
      if (!$target.closest("#editor").length && $("#editor").is(":visible")) {
        // Let view manager know that we are no longer working in the code editor
        self.view.isCodeMirror = false;
      }
    });

    $("#networkSelection").on("change", function (e) {
      command.send("select_network", e.currentTarget.value);
    });

    $("#exprUpdate").on("click", function (e) {
      // Attempt to update the expression via libmapper
      self.setMapProperty("expr", self.editor.getValue(""));
      // TODO: Handle Error Checking tasks 
    });

    $("#curveButton").on("click", function (e) {
      console.log("curveButton clicked!");
    });

    $("#exprButton").on("click", function (e) {
      console.log("exprButton clicked!");
    });

    //TODO: Note -- Expression handler is removed as it is now taken care of via codemirror

    $(".topMenu .protocol").on("click", function (e) {
      e.stopPropagation();
      self.setMapProperty("protocol", e.currentTarget.innerHTML);
    });

    $("body").on("keydown", function (e) {
      if (self.editor.hasFocus() == true)
        return;
      switch (e.which) {
        case 67: // 'C'
        {
          let selected = self.graph.maps.filter((m) => m.selected);
          if (selected && selected.size()) {
            self.view.showCurveEditor(
              self.getCurveProperties(),
              function (expr, c) {
                self.setMapProperty("expr", expr);
                self.setMapProperty("curve", c);
              }
            );
          }
          break;
        }
        case 68: // 'D'
          self.setMapProperty("process_location", "destination");
          break;
        case 69: // 'E'
          e.preventDefault();
          e.stopPropagation();
          self.editor.focus();
          self.view.isCodeMirror = true;
          break;
        case 73: // 'I'
          self.setMapProperty("use_inst", null);
          break;
        case 77: // 'M'
          self.setMapProperty("muted", null);
          break;
        case 83: // 'S'
          self.setMapProperty("process_location", "source");
          break;
        case 84: // 'T'
          self.setMapProperty("protocol", "TCP");
          break;
        case 85: // 'U'
          self.setMapProperty("protocol", "UDP");
          break;
      }});

    $(".expr_doc_link").click(function (e) {
      // show expression documentation
      $("#status")
        .stop(true, false)
        .empty()
        .load("./doc/expression_syntax.html")
        .css({
          left: "20%",
          top: 70,
          width: "60%",
          height: "calc(100% - 90px)",
          opacity: 0.9,
        });
    });
  }

  // clears and disables the map properties bar
  clearMapProperties() {
    $(".protocol").removeClass("sel");
    $(".topMenu .range").val("");
    $(".topMenu textarea").val("");
    $(".signalControl").children("*").removeClass("disabled");
    $(".signalControl").addClass("disabled");
    $("#exprTitle").removeClass("edited").addClass("disabled");
    $("#curveTitle").removeClass("edited").addClass("disabled");
    $(".expression").removeClass("waiting");
    this.editor.setValue("");
    $("#exprUpdate").prop("disabled", true);
  }

  selected(map) {
    return map.selected;
  }

  updateMapProperties() {
    this.clearMapProperties();

    var proto = null;
    var expr = null;
    var vars = {};

    let selected = this.graph.maps.filter((m) => m.selected);

    if (selected && selected.size()) {
      // something has been selected
      $("#exprTitle").removeClass("disabled");
      //            $('#curveTitle').removeClass('disabled');
      $(".signalControl").removeClass("disabled");
      $(".signalControl").children("*").removeClass("disabled");
    } else return;

    selected.forEach(function (map) {
      if (proto == null) proto = map.protocol;
      else if (proto != map.protocol) proto = "multiple";
      if (expr == null) expr = map.expr;
      else if (expr != map.expr) expr = "multiple expressions";

      for (let prop in map) {
        if (!map.hasOwnProperty(prop)) continue;
        if (!prop.startsWith("var@")) continue;
        let key = prop.slice(4);
        if (vars[key] == undefined) vars[key] = map[prop];
        else vars[key] = "multiple values";
      }
    });

    if (proto != null && proto != "multiple") {
      $("#proto" + proto).addClass("sel");
    }

    if (expr != null) {
      console.log("setting expr to", expr);

      this.editor.setValue(expr);
      $("#exprUpdate").prop("disabled", false);

      console.log("vars=", vars);

      function colorCode(e, v) {
        Raphael.getColor.reset();
        // color variable names
        for (let key in v) {
          let re = new RegExp("(?<![#a-z0-9])" + key + "(?![#a-z0-9])", "g");
          let color = Raphael.getColor();
          e = e.replace(
            re,
            "<span style='color:" + color + "'>" + key + "</span>"
          );
        }
        return e;
      }
    }
  }

  getCurveProperties() {
    var curveProps = {
      src_min: null,
      src_max: null,
      dst_min: null,
      dst_max: null,
      curve: null,
    };

    this.graph.maps.filter(this.selected).forEach(function (map) {
      if (map.srcs.length == 1) {
        if (curveProps.src_min == null) curveProps.src_min = map.srcs[0].min;
        if (curveProps.src_max == null) curveProps.src_max = map.srcs[0].max;
      }
      if (curveProps.dst_min == null) curveProps.dst_min = map.dst.min;
      if (curveProps.dst_max == null) curveProps.dst_max = map.dst.max;
      if (map.curve != "undefined") curveProps.curve = map.curve;
    });

    return curveProps;
  }

  // object with arguments for the map
  updateMapPropertiesFor(key) {
    // check if map is selected
    var map = this.graph.maps.find(key);
    if (this.selected(map)) this.updateMapProperties();
  }

  cacheMapProperty(key, value) {
    this.cachedProperty = { key: key, value: value };
  }

  sendCachedProperty() {
    if (
      !this.cachedProperty ||
      !this.cachedProperty.key ||
      !this.cachedProperty.value
    )
      return;
    this.setMapProperty(this.cachedProperty.key, this.cachedProperty.value);
  }

  setMapProperty(key, value) {
    let container = $(this.container);
    this.graph.maps.filter(this.selected).forEach(function (map) {
      if (map[key] && (map[key] == value || map[key] == parseFloat(value)))
        return;

      var msg = {};

      // set the property being modified
      switch (key) {
        case "muted":
          msg["muted"] = !map["muted"];
          break;
        case "use_inst":
          msg["use_inst"] = !map["use_inst"];
          break;
        case "expr":
          //                value = value.replace(/\r?\n|\r/g, '');
          // for user friendliness we will automatically insert missing vector indices
          for (var i in map.srcs) {
            console.log(
              "mapping srclen " +
                map.srcs.length +
                " to dstlen " +
                map.dst.length
            );
          }
          if (value == map.expr) return;
          msg["expr"] = value;
          $(".expression").addClass("waiting");
          break;
        default:
          msg[key] = value;
      }

      // copy src and dst names
      msg["srcs"] = map.srcs.map((s) => s.key);
      msg["dst"] = map["dst"].key;

      // send the command, should receive a /mapped message after.
      console.log("sending set_map", msg);
      command.send("set_map", msg);
    });
    this.cachedProperty = { key: null, value: null };
  }

  on_load() {
    var self = this;

    //A quick fix for now to get #container out of the way of the load dialogs
    var body = document.getElementsByTagName("body")[0];
    var iframe = document.createElement("iframe");
    iframe.name = "file_upload";
    iframe.style.visibility = "hidden";
    body.appendChild(iframe);

    var form = document.createElement("form");
    form.innerHTML =
      '<input id="file" type="file"                   \
                           name="mapping_json" size="40" accept="json">  \
                          <input type="submit" style="display: none;">   \
                          <input type="button" value="Cancel" id="cancel">';
    form.method = "POST";
    form.enctype = "multipart/form-data";
    form.action = "/load";
    form.target = "file_upload";

    var l = document.createElement("li");
    l.appendChild(form);
    $(".topMenu").append(l);

    iframe.onload = function () {
      //            var t = $(iframe.contentDocument.body).text();
      //            if (t.search('Success:') == -1 && t.search('Error:') == -1)
      //                return;
      self.notify($(iframe.contentDocument.body).text());
      $(l).remove();
      body.removeChild(iframe);
    };

    $("#cancel", form).click(function () {
      $(l).remove();
      $("#container").removeClass("onLoad");
      body.removeChild(iframe);
    });

    form.firstChild.onchange = function () {
      var fn = document.createElement("input");
      fn.type = "hidden";
      fn.name = "filename";
      fn.value = form.firstChild.value;
      form.appendChild(fn);

      // The devices currently in focused
      var devs = self.view.get_focused_devices();

      // Split them into sources and destinations
      var srcdevs = [];
      var dstdevs = [];
      this.graph.devices.forEach(function (dev) {
        if (devs.includes(dev.name)) {
          if (dev.num_sigs_out) srcdevs.push(dev.name);
          if (dev.num_sigs_in) dstdevs.push(dev.name);
        }
      });

      // So that the monitor can see which devices are being looked at
      var srcs = document.createElement("input");
      srcs.type = "hidden";
      srcs.name = "sources";
      srcs.value = srcdevs.join();
      form.appendChild(srcs);

      var dsts = document.createElement("input");
      dsts.type = "hidden";
      dsts.name = "destinations";
      dsts.value = dstdevs.join();
      form.appendChild(dsts);

      form.submit();
    };
    return false;
  }

  notify(msg) {
    var li = document.createElement("li");
    li.className = "notification";
    li.innerHTML = msg;
    $(".topMenu").append(li);
    setTimeout(function () {
      $(li).fadeOut("slow", function () {
        $(li).remove();
      });
    }, 5000);
  }

  /**
   * Updates the save/loading functions based on the view's state
   * currently set up for the list view only
   */
  updateSaveLocation(location) {
    // get the save location
    if (location) {
      window.saveLocation = location;
    } else {
      window.saveLocation = "";
    }

    // update the save button's link
    $("#saveButton").attr("href", window.saveLocation);

    // if saving is not ready, disable the save button
    if (window.saveLocation == "") {
      $("#saveButton, #loadButton").addClass("disabled");
    }
    // if saving is ready, enable the save button
    else {
      $("#saveButton, #loadButton").removeClass("disabled");
    }
  }
}
