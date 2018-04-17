var gQuicktext = Components.classes["@hesslow.se/quicktext/main;1"].getService(Components.interfaces.wzIQuicktext);
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var dragObserver =
{ 
  onDragStart: function (evt, transferData, action)
  {
    if (evt.originalTarget.localName != 'treechildren')
      return false;

    transferData.data = new TransferData();
    transferData.data.addDataForFlavour("quicktextTree", evt.target.getAttribute("label"));
    return true;
  }
}

var quicktext =
{
  mStringBundle:        null,
  mChangesMade:         false,
  mTextChangesMade:     [],
  mGeneralChangesMade:  [],
  mLoaded:              false,
  mTreeArray:           [],
  mCollapseState:       [],
  mPickedIndex:         null,
  mOS:                  "WINNT"
,
  init: function()
  {
    if (!this.mLoaded)
    {
      this.mLoaded = true;
      this.mStringBundle = document.getElementById("quicktextStringBundle");

      var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo).QueryInterface(Components.interfaces.nsIXULRuntime);
      this.mOS = appInfo.OS;

      gQuicktext.addObserver(this);
      var hasLoadedBefore = !gQuicktext.loadSettings(false);

      var states = gQuicktext.collapseState;
      if (states != "")
      {
        states = states.split(/;/);
        for (var i = 0; i < states.length; i++)
          this.mCollapseState[i] = (states[i] == "1");
      }

      var groupLength = gQuicktext.getGroupLength(true);
      if (states.length < groupLength)
      {
        for (var i = states.length; i < groupLength; i++)
          this.mCollapseState[i] = true;
      }

      if (hasLoadedBefore)
      {
        gQuicktext.startEditing();
        this.updateGUI();
      }

      // window.resizeTo(gQuicktext.getSettingsWindowSize(0), gQuicktext.getSettingsWindowSize(1));
      document.getElementById('tabbox-main').selectedIndex = 1;

      document.getElementById('text-keyword').addEventListener("keypress", function(e) { quicktext.noSpaceForKeyword(e); }, false);

      this.disableSave();
      document.documentElement.getButton("extra1").addEventListener("command", function(e) { quicktext.save(); }, false);
    }
  }
,
  unload: function()
  {
    gQuicktext.removeObserver(this);

    var states = [];
    for (var i = 0; i < this.mCollapseState.length; i++)
      states[i] = (this.mCollapseState[i]) ? "1" : "";
    gQuicktext.collapseState = states.join(";");

    document.getElementById('text-keyword').removeEventListener("keypress", function(e) { quicktext.noSpaceForKeyword(e); }, false);
  }
,
  close: function(aClose)
  {
    this.saveText();

    if (this.mChangesMade)
    {
      promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);
      if (promptService)
      {
        result = promptService.confirmEx(window,
                                         this.mStringBundle.getString("saveMessageTitle"),
                                         this.mStringBundle.getString("saveMessage"),
                                         (promptService.BUTTON_TITLE_SAVE * promptService.BUTTON_POS_0) +
                                         (promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1) +
                                         (promptService.BUTTON_TITLE_DONT_SAVE * promptService.BUTTON_POS_2),
                                         null, null, null,
                                         null, {value:0});
        switch (result)
        {
          // Cancel
          case 1:
            return false;
          // Save
          case 0:
            this.save();
            break;
          // Quit
          case 2:
            break;
        }
      }
    }

    if (aClose)
      window.close();

    return true;
  }
,
  save: function()
  {
    this.saveText();

    if (document.getElementById("checkbox-viewPopup"))
      gQuicktext.viewPopup = document.getElementById("checkbox-viewPopup").checked;
    if (document.getElementById("text-defaultImport"))
      gQuicktext.defaultImport = document.getElementById("text-defaultImport").value;
    if (document.getElementById("select-shortcutModifier"))
      gQuicktext.shortcutModifier = document.getElementById("select-shortcutModifier").value;
    if (document.getElementById("checkbox-shortcutTypeAdv"))
      gQuicktext.shortcutTypeAdv = document.getElementById("checkbox-shortcutTypeAdv").checked;
    if (document.getElementById("select-keywordKey"))
      gQuicktext.keywordKey = document.getElementById("select-keywordKey").value;
    if (document.getElementById("checkbox-collapseGroup"))
      gQuicktext.collapseGroup = document.getElementById("checkbox-collapseGroup").checked;

    gQuicktext.saveSettings();

    this.mChangesMade = false;
    this.mTextChangesMade = [];
    this.mGeneralChangesMade = [];
    this.disableSave();
  }
,
  shortcutTypeAdv: function()
  {
    if (this.mOS.substr(0, 3).toLowerCase() == "mac" || (this.mOS.substr(0, 3).toLowerCase() == "win" && document.getElementById('select-shortcutModifier').value == "alt"))
      return false;

    return document.getElementById('checkbox-shortcutTypeAdv').checked;
  }
,
  saveText: function()
  {
    if (this.mPickedIndex != null)
    {
      if (this.mPickedIndex[1] > -1)
      {
        var title = document.getElementById('text-title').value;
        if (title.replace(/[\s]/g, '') == "")
          title = this.mStringBundle.getString("newTemplate");

        this.saveTextCell(this.mPickedIndex[0], this.mPickedIndex[1], 'name', title);
        this.saveTextCell(this.mPickedIndex[0], this.mPickedIndex[1], 'text', document.getElementById('text').value);

        if (this.shortcutTypeAdv())
          this.saveTextCell(this.mPickedIndex[0], this.mPickedIndex[1], 'shortcut', document.getElementById('text-shortcutAdv').value);
        else
          this.saveTextCell(this.mPickedIndex[0], this.mPickedIndex[1], 'shortcut', document.getElementById('text-shortcutBasic').value);

        this.saveTextCell(this.mPickedIndex[0], this.mPickedIndex[1], 'type', document.getElementById('text-type').value);
        this.saveTextCell(this.mPickedIndex[0], this.mPickedIndex[1], 'keyword', document.getElementById('text-keyword').value.replace(/[\s]/g, ''));
        this.saveTextCell(this.mPickedIndex[0], this.mPickedIndex[1], 'subject', document.getElementById('text-subject').value);
      }
      else
      {
        var title = document.getElementById('text-title').value;
        if (title.replace(/[\s]/g, '') == "")
          title = this.mStringBundle.getString("newGroup");

        this.saveGroupCell(this.mPickedIndex[0], 'name', title);
      }
    }
  }
,
  saveTextCell: function (aGroupIndex, aTextIndex, aColumn, aValue)
  {
    var text = gQuicktext.getText(aGroupIndex, aTextIndex, true);
    if (typeof text[aColumn] != "undefined" && text[aColumn] != aValue)
    {
      text[aColumn] = aValue;

      this.changesMade();
      return true;
    }
    return false;
  }
,
  saveGroupCell: function (aGroupIndex, aColumn, aValue)
  {
    var group = gQuicktext.getGroup(aGroupIndex, true);
    if (typeof group[aColumn] != "undefined" && group[aColumn] != aValue)
    {
      group[aColumn] = aValue;

      this.changesMade();
      return true;
    }
    return false;
  }
,
  noSpaceForKeyword: function(e)
  {
    if (e.charCode == KeyEvent.DOM_VK_SPACE)
    {
      e.preventBubble();
      e.preventDefault();
    }
  }
,
  checkForGeneralChanges: function(aIndex)
  {
    var ids =   ['checkbox-viewPopup', 'checkbox-collapseGroup', 'select-shortcutModifier', 'checkbox-shortcutTypeAdv', 'select-keywordKey', 'text-defaultImport'];
    var type =  ['checked', 'checked', 'value', 'checked', 'value', 'value'];
    var keys =  ['viewPopup', 'collapseGroup', 'shortcutModifier', 'shortcutTypeAdv', 'keywordKey', 'defaultImport'];

    if (typeof ids[aIndex] == 'undefined')
      return;

    var value = document.getElementById(ids[aIndex])[type[aIndex]];

    if (gQuicktext[keys[aIndex]] != value)
      this.generalChangeMade(aIndex);
    else
      this.noGeneralChangeMade(aIndex);
  }
,
  checkForTextChanges: function(aIndex)
  {
    if (!this.mPickedIndex)
      return;

    var ids = ['text-title', 'text', 'text-shortcutBasic', 'text-type', 'text-keyword', 'text-subject'];
    var keys = ['name', 'text', 'shortcut', 'type', 'keyword', 'subject'];

    if (this.shortcutTypeAdv())
      ids[2] = 'text-shortcutAdv';

    var value = document.getElementById(ids[aIndex]).value;
    switch (aIndex)
    {
      case 0:
        if (value.replace(/[\s]/g, '') == "")
          if (this.mPickedIndex[1] > -1)
            value = this.mStringBundle.getString("newTemplate");
          else
            value = this.mStringBundle.getString("newGroup");
        break;
      case 2:
        if (this.shortcutTypeAdv())
        {
          value = value.replace(/[^\d]/g, '');
          document.getElementById(ids[aIndex]).value = value;
        }
      case 4:
        value = value.replace(/[\s]/g, '');
        document.getElementById(ids[aIndex]).value = value;
        break;
    }

    if (this.mPickedIndex[1] > -1)
    {
      if (gQuicktext.getText(this.mPickedIndex[0], this.mPickedIndex[1], true)[keys[aIndex]] != value)
        this.textChangeMade(aIndex);
      else
        this.noTextChangeMade(aIndex);
    }
    else
    {
      if (gQuicktext.getGroup(this.mPickedIndex[0], true)[keys[aIndex]] != value)
        this.textChangeMade(aIndex);
      else
        this.noTextChangeMade(aIndex);
    }

    if (aIndex == 0 || aIndex == 2)
    {
      var selectedIndex = document.getElementById('group-tree').view.selection.currentIndex;
      if (aIndex == 0)
      {
        this.mTreeArray[selectedIndex][6] = value;
      }
      else
      {
        this.mTreeArray[selectedIndex][7] = value;
      }
      document.getElementById('group-tree').treeBoxObject.invalidateRow(selectedIndex);
      this.updateVariableGUI();
    }
  }
,
  changesMade: function()
  {
    this.mChangesMade = true;
    this.enableSave();
  }
,
  anyChangesMade: function()
  {
    if (this.textChangesMade() || this.generalChangesMade())
      return true;

    return false;
  }
,
  generalChangesMade: function()
  {
    for (var i = 0; i < this.mGeneralChangesMade.length; i++)
    {
      if (typeof this.mGeneralChangesMade[i] != "undefined" && this.mGeneralChangesMade[i] == true)
        return true;
    }

    return false;
  }
,
  generalChangeMade: function(aIndex)
  {
    this.enableSave();

    this.mGeneralChangesMade[aIndex] = true;
  }
,
  noGeneralChangeMade: function(aIndex)
  {
    this.mGeneralChangesMade[aIndex] = false;

    if (!this.mChangesMade && !this.anyChangesMade())
      this.disableSave();
  }
,
  textChangesMade: function()
  {
    for (var i = 0; i < this.mTextChangesMade.length; i++)
    {
      if (typeof this.mTextChangesMade[i] != "undefined" && this.mTextChangesMade[i] == true)
        return true;
    }

    return false;
  }
,
  textChangeMade: function(aIndex)
  {
    this.enableSave();

    this.mTextChangesMade[aIndex] = true;
  }
,
  noTextChangeMade: function(aIndex)
  {
    this.mTextChangesMade[aIndex] = false;

    if (!this.mChangesMade && !this.anyChangesMade())
      this.disableSave();
  }
,
  /*
   * GUI CHANGES
   */
  updateGUI: function()
  {

    // Set the date/time in the variablemenu
    var timeStamp = new Date();

    var options = {};
    options["date-short"] = { year: "numeric", month: "2-digit", day: "2-digit" }; 
    options["date-long"] = { weekday: "long", year: "numeric", month: "long", day: "2-digit" };
    options["time-noseconds"] = { hour: "2-digit", minute: "2-digit" }; 
    options["time-seconds"] = { hour: "2-digit", minute: "2-digit", second: "2-digit" };
      
    let fields = Object.keys(options);
    for (let i=0; i < fields.length; i++) {
        let field = fields[i];
        let fieldtype = field.split("-")[0];
        if (document.getElementById(field)) {
            document.getElementById(field).setAttribute("label", this.mStringBundle.getFormattedString(fieldtype, [new Intl.DateTimeFormat([], options[field]).format(timeStamp)]));
        }
    }

    // Update info in the generalsettings tab
    if (document.getElementById("checkbox-viewPopup"))
      document.getElementById("checkbox-viewPopup").checked = gQuicktext.viewPopup;
    if (document.getElementById("checkbox-collapseGroup"))
      document.getElementById("checkbox-collapseGroup").checked = gQuicktext.collapseGroup;
    if (document.getElementById("select-shortcutModifier"))
      document.getElementById("select-shortcutModifier").value = gQuicktext.shortcutModifier;
    if (document.getElementById("checkbox-shortcutTypeAdv"))
    {
      var elem = document.getElementById("checkbox-shortcutTypeAdv");
      elem.checked = gQuicktext.shortcutTypeAdv;

      this.shortcutModifierChange();
    }
    if (document.getElementById("text-defaultImport"))
      document.getElementById("text-defaultImport").value = gQuicktext.defaultImport;
    if (document.getElementById("select-keywordKey"))
      document.getElementById("select-keywordKey").value = gQuicktext.keywordKey;    

    // Update the variable menu 
    this.updateVariableGUI();

    // Update the tree
    this.buildTreeGUI();

    // Update the remove and add buttons
    this.updateButtonStates();
  }
,
  updateVariableGUI: function()
  {
    // Set all other text in the variablemenu
    var topParent = document.getElementById('quicktext-other-texts');
    for (var i = topParent.childNodes.length-1; i >= 0 ; i--)
      topParent.removeChild(topParent.childNodes[i]);

    var groupLength = gQuicktext.getGroupLength(true);
    if (groupLength > 0)
    {
      topParent.removeAttribute('hidden');
      parent = document.createElement("menupopup");
      parent = topParent.appendChild(parent);
      for(var i = 0; i < groupLength; i++)
      {
        var textLength = gQuicktext.getTextLength(i, true);
        if (textLength > 0)
        {
          var group = gQuicktext.getGroup(i, true);
          var groupElem = document.createElement("menu");
          groupElem.setAttribute('label', group.name);
          groupElem = parent.appendChild(groupElem);
  
          groupParent = document.createElement("menupopup");
          groupParent = groupElem.appendChild(groupParent);
          for (var j = 0; j < textLength; j++)
          {
            var textElem = document.createElement("menuitem");
            var text = gQuicktext.getText(i, j, true);
            textElem.setAttribute('label', text.name);
            textElem.setAttribute('oncommand', "quicktext.insertVariable('TEXT="+ group.name +"|"+ text.name +"');");
            textElem = groupParent.appendChild(textElem);
          }
        }
      }
    }
    else
      topParent.setAttribute('hidden', true);
  }
,
  disableShortcuts: function(aShortcut)
  {
    var grouplist = document.getElementById('text-shortcutBasic');
    for (var i = 0; i <= 10; i++)
      grouplist.firstChild.childNodes[i].removeAttribute("disabled");

    var groupLength = gQuicktext.getGroupLength(true);
    for (var i = 0; i < groupLength; i++)
    {
      var textLength = gQuicktext.getTextLength(i, true);
      for (var j = 0; j < textLength; j++)
      {
        var shortcut = gQuicktext.getText(i, j, true).shortcut;
        var selectedIndex = (shortcut == "0") ? 10 : shortcut;
        if (shortcut != "" && shortcut != aShortcut && grouplist.firstChild.childNodes[selectedIndex])
          grouplist.firstChild.childNodes[selectedIndex].setAttribute("disabled", true);
      }
    }
  }
,

  disableSave: function()
  {
    document.documentElement.getButton("extra1").setAttribute("disabled", true);
    document.getElementById("toolbar-save").setAttribute("disabled", true);
  }
,

  enableSave: function()
  {
    document.documentElement.getButton("extra1").removeAttribute("disabled");
    document.getElementById("toolbar-save").removeAttribute("disabled");
  }
,
  /*
   * INSERT VARIABLES
   */
  insertVariable: function(aStr)
  {
    var textbox = document.getElementById("text-subject");
    if (!textbox.getAttribute("focused"))
      var textbox = document.getElementById("text");

    var selStart = textbox.selectionStart;
    var selEnd = textbox.selectionEnd;
    var selLength = textbox.textLength;

    var s1 = (textbox.value).substring(0,selStart);
    var s2 = (textbox.value).substring(selEnd, selLength)
    textbox.value = s1 + "[[" + aStr + "]]" + s2;

    var selNewStart = selStart + 4 + aStr.length;
    textbox.setSelectionRange(selNewStart, selNewStart);
  }
,
  insertFileVariable: function()
  {
    if ((file = gQuicktext.pickFile(window, -1, 0, this.mStringBundle.getString("insertFile"))) != null)
      this.insertVariable('FILE=' + file.path);
  }
,

  /*
   * IMPORT/EXPORT FUNCTIONS
   */
  exportTemplatesToFile: function()
  {
    if ((file = gQuicktext.pickFile(window, 2, 1, this.mStringBundle.getString("exportFile"))) != null)
      gQuicktext.exportTemplatesToFile(file);
  }
,
  importTemplatesFromFile: function()
  {
    if ((file = gQuicktext.pickFile(window, 2, 0, this.mStringBundle.getString("importFile"))) != null)
    {
      this.saveText();

      var length = this.mTreeArray.length;
      gQuicktext.importFromFile(file, 0, false, true);

      this.changesMade();
      this.makeTreeArray();
      document.getElementById('group-tree').treeBoxObject.rowCountChanged(length-1, this.mTreeArray.length-length);
      this.updateButtonStates();
    }
  }
,
  pickText: function()
  {
    var index = document.getElementById('group-tree').view.selection.currentIndex;

    if (!this.mTreeArray[index])
    {
      document.getElementById('text-caption').setAttribute("label", this.mStringBundle.getString("group"));
      document.getElementById('text-title').value = "";
      this.showElement("group", true);
      this.mPickedIndex = null;
      return;
    }

    groupIndex = this.mTreeArray[index][0];
    textIndex = this.mTreeArray[index][1];

    if (this.mPickedIndex && this.textChangesMade())
    {
      this.changesMade();
      this.mTextChangesMade = [];
      this.saveText();
    }

    this.mPickedIndex = [groupIndex, textIndex];

    if (textIndex > -1)
    {
      var text = gQuicktext.getText(groupIndex, textIndex, true);
      document.getElementById('text-caption').setAttribute("label", this.mStringBundle.getString("template"));

      document.getElementById('text-title').value = text.name;
      document.getElementById('text').value = text.text;
      document.getElementById('text-keyword').value = text.keyword;
      document.getElementById('text-subject').value = text.subject;

      document.getElementById('label-shortcutModifier').value = this.mStringBundle.getString(document.getElementById('select-shortcutModifier').value +"Key") +"+";


      if (this.shortcutTypeAdv())
      {
        var elem = document.getElementById('text-shortcutAdv');
        elem.value = text.shortcut;

        elem.hidden = false;
        document.getElementById('text-shortcutBasic').hidden = true;
      }
      else
      {
        var shortcut = text.shortcut;
        var elem = document.getElementById('text-shortcutBasic');

        if (shortcut < 10)
          elem.selectedIndex = (shortcut == "0") ? 10 : shortcut;
        else
          elem.selectedIndex = 0;

        elem.hidden = false;
        document.getElementById('text-shortcutAdv').hidden = true;

        this.disableShortcuts(shortcut);
      }

      var type = text.type;
      if (!(type > 0)) type = 0;
      document.getElementById('text-type').selectedIndex = type;
    }
    else
    {
      document.getElementById('text-caption').setAttribute("label", this.mStringBundle.getString("group"));

      document.getElementById("text-title").value = gQuicktext.getGroup(groupIndex, true).name;
      document.getElementById("text").value = "";
      document.getElementById("text-keyword").value = "";
      document.getElementById("text-subject").value = "";
    }

    var disabled = false;
    if (gQuicktext.getGroup(groupIndex, true).type > 0)
    {
      document.getElementById("group-button-remove").setAttribute("disabled", true);
      document.getElementById("group-button-add-text").setAttribute("disabled", true);
      disabled = true;
    }
    else
    {
      document.getElementById("group-button-remove").removeAttribute("disabled");
      document.getElementById("group-button-add-text").removeAttribute("disabled");
    }

    if (textIndex < 0)
      this.showElement("group", disabled);
    else
      this.showElement("text", disabled);
  }
,
  showElement: function(aType, aDisabled)
  {
    var elements = document.getElementsByAttribute("candisable", "true");
    for (var i = 0; i < elements.length; i++)
    {
      if (aDisabled)
        elements[i].setAttribute("disabled", true);
      else
        elements[i].removeAttribute("disabled");
    }

    var elements = document.getElementsByAttribute("showfor", "*");
    for (var i = 0; i < elements.length; i++)
    {
      var types = elements[i].getAttribute("showfor").split(",");
      var found = false;
      for (var type = 0; type < types.length; type++)
      {
        if (types[type] == aType)
          found = true;
      }

      if (found)
        elements[i].hidden = false;
      else
        elements[i].hidden = true;
    }
  }
,

  /*
   * Add/Remove groups/templates
   */
  addGroup: function()
  {
    var title = this.mStringBundle.getString("newGroup");
    this.saveText();

    gQuicktext.addGroup(title, true);
    this.mCollapseState.push(true);

    this.makeTreeArray();
    var treeBoxObject = document.getElementById('group-tree').treeBoxObject;
    treeBoxObject.rowCountChanged(this.mTreeArray.length-1, 1);
    document.getElementById('group-tree').treeBoxObject.invalidateRow(this.mTreeArray.length-1);

    selectedIndex = this.mTreeArray.length - 1;
    this.selectTreeRow(selectedIndex);

    this.updateButtonStates();
    this.changesMade();

    var titleElem = document.getElementById('text-title');
    titleElem.focus();
    titleElem.setSelectionRange(0, title.length);
  }
,
  addText: function()
  {
    var title = this.mStringBundle.getString("newTemplate");
    this.saveText();

    var groupIndex = -1;
    if (this.mPickedIndex)
      groupIndex = this.mPickedIndex[0];

    var groupLength = gQuicktext.getGroupLength(true);
    if (groupIndex == -1)
    {
      if (groupLength == 0)
        return;
      else
        groupIndex = 0;
    }

    gQuicktext.addText(groupIndex, title, true);

    this.makeTreeArray();
    var selectedIndex = -1;
    for (var i = 0; i <= groupIndex; i++)
    {
      selectedIndex++;
      if (this.mCollapseState[i])
        selectedIndex += gQuicktext.getTextLength(i, true);
    }

    var treeBoxObject = document.getElementById('group-tree').treeBoxObject;
    treeBoxObject.rowCountChanged(selectedIndex-1, 1);
    treeBoxObject.invalidateRow(selectedIndex);
    this.selectTreeRow(selectedIndex);

    this.updateButtonStates();
    this.changesMade();

    var titleElem = document.getElementById('text-title');
    titleElem.focus();
    titleElem.setSelectionRange(0, title.length);
  }
,
  removeText: function()
  {
    this.saveText();

    if (this.mPickedIndex)
    {
      var groupIndex = this.mPickedIndex[0];
      var textIndex = this.mPickedIndex[1];

      var title = gQuicktext.getGroup(groupIndex, true).name;
      if (textIndex > -1)
        title = gQuicktext.getText(groupIndex, textIndex, true).name;

      if (confirm (this.mStringBundle.getFormattedString("remove", [title])))
      {
        this.mPickedIndex = null;

        var textLength = gQuicktext.getTextLength(groupIndex, true);

        var selectedIndex = document.getElementById('group-tree').view.selection.currentIndex;
        var moveSelectionUp = false;
        if (this.mTreeArray[selectedIndex+1] && this.mTreeArray[selectedIndex+1][2] < this.mTreeArray[selectedIndex][2])
          moveSelectionUp = true;

        var treeBoxObject = document.getElementById('group-tree').treeBoxObject;
        if (textIndex == -1)
        {
          gQuicktext.removeGroup(groupIndex, true);

          if (this.mCollapseState[groupIndex])
            treeBoxObject.rowCountChanged(selectedIndex, -(textLength+1));
          else
            treeBoxObject.rowCountChanged(selectedIndex, -1);

          this.makeTreeArray();
          treeBoxObject.invalidate();
        }
        else
        {
          gQuicktext.removeText(groupIndex, textIndex, true);

          treeBoxObject.rowCountChanged(selectedIndex, -1);
          this.makeTreeArray();
          treeBoxObject.invalidate();
        }

        this.updateVariableGUI();
        this.updateButtonStates();
        this.changesMade();

        var selectedRow = false;
        if (moveSelectionUp)
        {
          selectedRow = true;
          this.selectTreeRow(selectedIndex-1);
        }

        var rowCount = this.mTreeArray.length -1;
        if (selectedIndex > rowCount || selectedIndex == -1)
        {
          selectedRow = true;
          this.selectTreeRow(rowCount);
        }

        if (!selectedRow)
          this.selectTreeRow(selectedIndex);
      }
    }
  }
,
  /*
   * Update the treeview
   */
  makeTreeArray: function()
  {
    this.mTreeArray = [];
    var k = 0;

    var groupLength = gQuicktext.getGroupLength(true);

    if (this.mCollapseState.length < groupLength)
    {
      for (var i = this.mCollapseState.length; i < groupLength; i++)
        this.mCollapseState[i] = true;
    }
    else if (this.mCollapseState.length > groupLength)
      this.mCollapseState.splice(groupLength, this.mCollapseState.length - groupLength);

    for (var i = 0; i < groupLength; i++)
    {
      var groupIndex = k;
      var textLength = gQuicktext.getTextLength(i, true);

      this.mTreeArray[k] = [i, -1, 0, -1, true, textLength, gQuicktext.getGroup(i, true).name, ''];
      k++;

      if (!this.mCollapseState[i])
        continue;

      for (var j = 0; j < textLength; j++)
      {
        var text = gQuicktext.getText(i, j, true);
        var shortcut = text.shortcut;
        this.mTreeArray[k] = [i, j, 1, groupIndex, false, 0, text.name, shortcut];
        k++;
      }
    }
  }
,
  updateTreeGUI: function()
  {
    // maybe
  }
,
  buildTreeGUI: function()
  {
    this.makeTreeArray();

    var treeview = {
      rowCount: this.mTreeArray.length,
      lastIndex: null,

      isContainer: function(aRow)
      {
        return (quicktext.mTreeArray[aRow][1] == -1);
      },
      isContainerOpen: function(aRow)
      {
        return quicktext.mCollapseState[quicktext.mTreeArray[aRow][0]];
      },
      isContainerEmpty: function(aRow)
      {
        return (quicktext.mTreeArray[aRow][5] == 0);
      },
      isSeparator: function(aRow)
      {
        return false;
      },
      isSorted: function(aRow)
      {
        return false;
      },
      isEditable: function(aRow)
      {
        return false;
      },
      hasNextSibling: function(aRow, aAfter)
      {
        return (quicktext.mTreeArray[aAfter+1]
                && quicktext.mTreeArray[aRow][2] == quicktext.mTreeArray[aAfter+1][2]
                && quicktext.mTreeArray[aRow][3] == quicktext.mTreeArray[aAfter+1][3]);
      },
      getLevel: function(aRow)
      {
        return quicktext.mTreeArray[aRow][2];
      },
      getImageSrc: function(aRow, aCol) { return null; },
      getParentIndex: function(aRow)
      {
        return quicktext.mTreeArray[aRow][3];
      },
      getRowProperties: function(aRow, aProps) { },
      getCellProperties: function(aRow, aCol, aProps) { },
      getColumnProperties: function(aColid, aCol, aProps) { },
      getProgressMode: function(aRow, aCol) { },
      getCellValue: function(aRow, aCol) { return null; },
      canDropBeforeAfter: function(aRow, aBefore)
      {
        if (aBefore)
          return this.canDrop(aRow, -1);

        return this.canDrop(aRow, 1);
      },
      canDropOn: function(aRow)
      {
        return this.canDrop(aRow, 0);
      },
      canDrop: function(aRow, aOrient)
      {
        var index = document.getElementById('group-tree').view.selection.currentIndex;
        if (index == aRow)
          return false;

        // Can only drop templates on groups
        if (aOrient == 0)
        {
          if (quicktext.mTreeArray[index][2] > 0 && quicktext.mTreeArray[aRow][2] == 0)
            return true;
          else
            return false;
        }

        // Take care if we drag a group
        if (quicktext.mTreeArray[index][2] == 0)
        {
          if (aOrient < 0 && quicktext.mTreeArray[aRow][2] == 0)
            return true;
          if (aOrient > 0 && quicktext.mTreeArray.length-1 == aRow)
            return true;
        }
        // Take care if we drag a template
        else
        {
          if (quicktext.mTreeArray[aRow][2] > 0)
            return true;
        }

        return false;
      },
      drop: function(aRow, aOrient)
      {
        quicktext.saveText();
        quicktext.mPickedIndex = null;
        var selectIndex = -1;
        var index = document.getElementById('group-tree').view.selection.currentIndex;

        // Droping a group
        if (quicktext.mTreeArray[index][2] == 0)
        {
          var textLength = gQuicktext.getTextLength(quicktext.mTreeArray[index][0], true);
          if (!quicktext.mCollapseState[quicktext.mTreeArray[index][0]])
            textLength = 0;

          if (aOrient > 0)
          {
            gQuicktext.moveGroup(quicktext.mTreeArray[index][0], gQuicktext.getGroupLength(true), true);

            var state = quicktext.mCollapseState.splice(quicktext.mTreeArray[index][0], 1);
            state = (state == "false") ? false : true;
            quicktext.mCollapseState.push(state);

            selectIndex = quicktext.mTreeArray.length - textLength - 1;
          }
          else
          {
            gQuicktext.moveGroup(quicktext.mTreeArray[index][0], quicktext.mTreeArray[aRow][0], true);

            var state = quicktext.mCollapseState.splice(quicktext.mTreeArray[index][0], 1);
            state = (state == "false") ? false : true;
            quicktext.mCollapseState.splice(quicktext.mTreeArray[aRow][0], 0, state);

            selectIndex = (aRow > index) ? aRow - textLength - 1 : aRow;
          }
        }
        // Droping a template
        else
        {
          switch (aOrient)
          {
            case 0:
              var textLength = gQuicktext.getTextLength(quicktext.mTreeArray[aRow][0], true);
              gQuicktext.moveText(quicktext.mTreeArray[index][0], quicktext.mTreeArray[index][1], quicktext.mTreeArray[aRow][0], textLength, true);
              selectIndex = (quicktext.mTreeArray[index][0] == quicktext.mTreeArray[aRow][0] || aRow > index) ? aRow + textLength : aRow + textLength + 1;
              break;
            case 1:
              gQuicktext.moveText(quicktext.mTreeArray[index][0], quicktext.mTreeArray[index][1], quicktext.mTreeArray[aRow][0], quicktext.mTreeArray[aRow][1]+1, true);
              selectIndex = (aRow > index) ? aRow : aRow + 1;
              break;
            default:
              gQuicktext.moveText(quicktext.mTreeArray[index][0], quicktext.mTreeArray[index][1], quicktext.mTreeArray[aRow][0], quicktext.mTreeArray[aRow][1], true);
              selectIndex = (aRow > index) ? aRow - 1 : aRow;
              break;
          }
        }

        quicktext.makeTreeArray();
        document.getElementById('group-tree').treeBoxObject.invalidate();
        document.getElementById('group-tree').view.selection.select(selectIndex);
        quicktext.changesMade();
      },
      getCellText: function(aRow, aCol)
      {
        colName = (aCol.id) ? aCol.id : aCol;
        if (colName == "group")
        {
          return quicktext.mTreeArray[aRow][6];
        }
        else if (colName == "shortcut" && quicktext.mTreeArray[aRow][1] > -1)
        {
          return quicktext.mTreeArray[aRow][7];
        }

        return "";
      },
      toggleOpenState: function(aRow)
      {
        var state = quicktext.mCollapseState[quicktext.mTreeArray[aRow][0]];
        quicktext.mCollapseState[quicktext.mTreeArray[aRow][0]] = !state;

        quicktext.makeTreeArray();

        var treeBoxObject = document.getElementById('group-tree').treeBoxObject;

        if (state)
          treeBoxObject.rowCountChanged(aRow, -quicktext.mTreeArray[aRow][5]);
        else
          treeBoxObject.rowCountChanged(aRow, quicktext.mTreeArray[aRow][5]);

        treeBoxObject.invalidate();
        document.getElementById('group-tree').view.selection.select(aRow);
      },
      setTree: function(aTreebox)
      {
        this.treebox=aTreebox;
      }
    }

    var firstVisibleRow = document.getElementById('group-tree').treeBoxObject.getFirstVisibleRow();
    var selectedIndex = document.getElementById('group-tree').view.selection.currentIndex;
    if (selectedIndex == -1 && this.mTreeArray.length)
      selectedIndex = 0;

    document.getElementById('group-tree').view = treeview;
    document.getElementById('group-tree').treeBoxObject.scrollToRow(firstVisibleRow);
    this.selectTreeRow(selectedIndex);

    this.pickText();
  }
,
  selectTreeRow: function(aRow)
  {
    document.getElementById('group-tree').view.selection.select(aRow);
    document.getElementById('group-tree').treeBoxObject.ensureRowIsVisible(aRow);
  }
,
  updateButtonStates: function()
  {
    // Update the add-buttons
    if (this.mTreeArray.length)
    {
      var index = document.getElementById('group-tree').view.selection.currentIndex;
      if (this.mTreeArray[index] && gQuicktext.getGroup(this.mTreeArray[index][0], true).type > 0)
      {
        document.getElementById("group-button-remove").setAttribute("disabled", true);
        document.getElementById("group-button-add-text").setAttribute("disabled", true);
      }
      else
      {
        document.getElementById("group-button-remove").removeAttribute("disabled");
        document.getElementById("group-button-add-text").removeAttribute("disabled");
      }
    }
    else
    {
      document.getElementById('group-button-add-text').setAttribute("disabled", true);
      document.getElementById('group-button-remove').setAttribute("disabled", true);
    }
  }
,
  openHomepage: function()
  {
    gQuicktext.openHomepage();
  }
,
  shortcutModifierChange: function()
  {
    var state = (this.mOS.substr(0, 3).toLowerCase() == "mac" || (this.mOS.substr(0, 3).toLowerCase() == "win" && document.getElementById('select-shortcutModifier').value == "alt"));
    document.getElementById('checkbox-shortcutTypeAdv').disabled = state;
  }
,

  /*
   * OBSERVERS
   */
  observe: function(aSubject, aTopic, aData)
  {
    if (aTopic == "updatesettings")
    {
      // this.updateGUI();
    }
  }
,
  createInstance: function(aOuter, aIID)
  {
    if (aOuter != null) throw Components.results.NS_ERROR_NO_AGGREGATION;
    return policy;
  }
,
  QueryInterface: XPCOMUtils.generateQI([
    Components.interfaces.nsIObserver,
    Components.interfaces.nsISupportsWeakReference,
    Components.interfaces.nsIFactory,
    ])
}
