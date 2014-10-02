/*
 * MEItoVexFlow, Converter class
 * (based on meitovexflow.js)
 * Reworkings: Alexander Erhard
 *
 * Copyright © 2014 Richard Lewis, Raffaele Viglianti, Zoltan Komives,
 * University of Maryland
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

/*
 * MEItoVexFlow
 *
 * Author: Richard Lewis Contributors: Zoltan Komives, Raffaele Viglianti
 *
 * See README for details of this library
 *
 * Copyright © 2012, 2013 Richard Lewis, Raffaele Viglianti, Zoltan Komives,
 * University of Maryland
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

define([
  'vexflow',
  'meilib/MeiLib',
  'common/Logger',
  'common/RuntimeError',
  'common/Util',
  'mei2vf/event/EventUtil',
  'mei2vf/event/Note',
  'mei2vf/event/GraceNote',
  'mei2vf/event/Chord',
  'mei2vf/event/GraceChord',
  'mei2vf/event/Rest',
  'mei2vf/event/MRest',
  'mei2vf/event/Space',
  'mei2vf/eventlink/Hairpins',
  'mei2vf/eventlink/Ties',
  'mei2vf/eventlink/Slurs',
  'mei2vf/eventpointer/Directives',
  'mei2vf/eventpointer/Dynamics',
  'mei2vf/eventpointer/Fermatas',
  'mei2vf/eventpointer/Ornaments',
  'mei2vf/lyrics/Verses',
  'mei2vf/lyrics/Syllable',
  'mei2vf/stave/Stave',
  'mei2vf/measure/Measure',
  'mei2vf/system/System',
  'mei2vf/system/SystemInfo',
  'mei2vf/Tables',
  'mei2vf/voice/StaveVoices'
], function (VF, MeiLib, Logger, RuntimeError, Util, EventUtil, Note, GraceNote, Chord, GraceChord, Rest, MRest, Space, Hairpins, Ties, Slurs, Directives, Dynamics, Fermatas, Ornaments, Verses, Syllable, Stave, Measure, System, SystemInfo, Tables, StaveVoices) {

  /**
   * Converts an MEI XML document / document fragment to VexFlow objects and
   * optionally renders it using Raphael or HTML5 Canvas.
   *
   * Usage:
   *
   * - Either pass a config object to the constructor function or (if no config
   * object has been passed) call {@link #initConfig} after construction.
   * - Call {@link #process} to process an MEI XML document
   * - Call {@link #draw} to draw the processed VexFlow objects to a canvas
   *
   * @class MEI2VF.Converter
   *
   * @constructor
   * @param {Object} [config]
   * @chainable
   * @return {MEI2VF.Converter} this
   */
  var Converter = function (config) {
    if (config) {
      this.initConfig(config);
    }
    return this;
  };

  Converter.prototype = {

    BOTTOM : VF.Annotation.VerticalJustify.BOTTOM,

    defaults : {
      /**
       * @cfg {Number} pageWidth The width of the page
       */
      pageWidth : 800,
      /**
       * @cfg {Number} pageTopMar The top page margin
       */
      pageTopMar : 60,
      /**
       * @cfg {Number} pageLeftMar The left page margin
       */
      pageLeftMar : 20,
      /**
       * @cfg {Number} pageRightMar The right page margin
       */
      pageRightMar : 20,
      /**
       * @cfg {Number} systemSpacing The spacing between two stave
       * systems
       */
      systemSpacing : 90,
      /**
       * @cfg {Number} staveSpacing The default spacing between two staves
       * within a system; overridden by the spacing attribute of a staffDef
       * element in the MEI code
       */
      staveSpacing : 60,
      /**
       * @cfg {Boolean} autoStaveConnectorLine Specifies if a stave connector
       * line is drawn on the left of systems by default; if set to true, the
       * auto line will not appear when staffDef/@symbol="none" is set for the
       * outermost staffDef element
       */
      autoStaveConnectorLine : true,
      /**
       * @cfg {Boolean} renderFermataAttributes Specifies if fermata attributes should
       * be rendered. Defaults to `true`
       */
      /**
       * @cfg {"full"/"abbr"/null} labelMode Specifies the way voice labels are
       * added
       * to staves. Values:
       *
       * - 'full': renders full labels in the first system, abbreviated labels
       * in all following systems
       * - 'abbr': only render abbreviated labels
       * - null or undefined: renders no labels
       */
      labelMode : null, // 'full',
      processSb : 'sb', // sb / ignore
      processPb : 'sb', // pb / sb / ignore
      /**
       * @cfg {Number} maxHyphenDistance The maximum distance (in pixels)
       * between two hyphens in the lyrics lines
       */
      maxHyphenDistance : 75,
      /**
       * @cfg {Object} lyricsFont The font used for rendering lyrics (and
       * hyphens)
       * @cfg {String} lyricsFont.family the font family
       * @cfg {Number} lyricsFont.size the font size
       *
       * NB the weight properties can be used to specify style, weight
       * or both (space separated); some of the objects are passed directly
       * to vexFlow (which requires the name 'weight'), so the name is
       * 'weight'
       */
      lyricsFont : {
        family : 'Times',
        size : 13,
        spacing : 1.3
      },
      /**
       * @cfg {Object} annotFont the font used for annotations (for example,
       * 'pizz.')
       * @cfg {String} annotFont.family the font family
       * @cfg {Number} annotFont.size the font size
       * @cfg {String} annotFont.weight the font weight
       */
      annotFont : {
        family : 'Times',
        size : 15,
        weight : 'Italic'
      },
      /**
       * @cfg {Object} dynamFont the font used for dynamics
       * @cfg {String} dynamFont.family the font family
       * @cfg {Number} dynamFont.size the font size
       * @cfg {String} dynamFont.weight the font weight
       */
      dynamFont : {
        family : 'Times',
        size : 18,
        weight : 'bold italic'
      },
      /**
       * @cfg {Object} tempoFont The tempo font
       * @cfg {String} tempoFont.family the font family
       * @cfg {Number} tempoFont.size the font size
       * @cfg {String} tempoFont.weight the font weight
       */
      tempoFont : {
        family : "Times",
        size : 17,
        weight : "bold"
      }
    },

    /**
     * initializes the Converter
     * @method initConfig
     * @param {Object} config A config object (optional)
     * @chainable
     * @return {Converter} this
     */
    initConfig : function (config) {
      var me = this;
      me.cfg = Util.extend({}, me.defaults, config);
      /**
       * an instance of MEI2VF.SystemInfo dealing with the system and stave
       * info derived from the MEI data
       * @property {MEI2VF.SystemInfo} systemInfo
       */
      me.systemInfo = new SystemInfo();
      /**
       * The print space coordinates calculated from the page config.
       * @property {Object} printSpace
       * @property {Number} printSpace.top
       * @property {Number} printSpace.left
       * @property {Number} printSpace.right
       * @property {Number} printSpace.width
       */
      me.printSpace = {
        // substract four line distances (40px) from pageTopMar in order
        // to compensate VexFlow's default top spacing / allow specifying
        // absolute values
        top : me.cfg.pageTopMar - 40,
        left : me.cfg.pageLeftMar,
        right : me.cfg.pageWidth - me.cfg.pageRightMar,
        width : Math.floor(me.cfg.pageWidth - me.cfg.pageRightMar - me.cfg.pageLeftMar) - 1
      };
      if (me.cfg.renderFermataAttributes === true) {
        EventUtil.addFermataAtt = EventUtil.addFermata;
      }
      switch (me.cfg.processSb) {
        case 'pb' :
          me.onSb = me.setPendingPageBreak;
          break;
        case 'sb' :
          me.onSb = me.setPendingSystemBreak;
          break;
        default :
          me.onSb = me.emptyFn;
      }
      switch (me.cfg.processPb) {
        case 'pb' :
          me.onPb = me.setPendingPageBreak;
          break;
        case 'sb' :
          me.onPb = me.setPendingSystemBreak;
          break;
        default :
          me.onPb = me.emptyFn;
      }
      return me;

    },

    emptyFn : function () {
    },

    /**
     * Resets all data. Called by {@link #process}.
     * @method reset
     * @chainable
     * @return {Converter} this
     */
    reset : function () {
      var me = this;
      me.systemInfo.init(me.cfg, me.printSpace);
      /**
       * @property {MEI2VF.EventLink[][]} unresolvedTStamp2
       */
      me.unresolvedTStamp2 = [];
      /**
       * Contains all {@link MEI2VF.System} objects
       * @property {MEI2VF.System[]} systems
       */
      me.systems = [];
      /**
       * Contains all Vex.Flow.Stave objects. Addressing scheme:
       * [measure_n][stave_n]
       * @property {Vex.Flow.Stave[][]} allVexMeasureStaves
       */
      me.allVexMeasureStaves = [];
      /**
       * Contains all Vex.Flow.Beam objects. Data is just pushed in
       * and later processed as a whole, so the array index is
       * irrelevant.
       * @property {Vex.Flow.Beam[]} allBeams
       */
      me.allBeams = [];
      /**
       * Contains all Vex.Flow.Tuplet objects. Data is just pushed in
       * and later processed as a whole, so the array index is
       * irrelevant.
       * @property {Vex.Flow.Tuplet[]} allTuplets
       */
      me.allTuplets = [];
      /**
       * an instance of MEI2VF.Dynamics dealing with and storing all dynamics
       * found in the MEI document
       * @property {MEI2VF.Dynamics} dynamics
       */
      me.dynamics = new Dynamics(me.systemInfo, me.cfg.dynamFont);
      /**
       * an instance of MEI2VF.Directives dealing with and storing all
       * directives found in the MEI document
       * @property {MEI2VF.Directives} directives
       */
      me.directives = new Directives(me.systemInfo, me.cfg.annotFont);
      /**
       * an instance of MEI2VF.Fermatas dealing with and storing all
       * fermata elements found in the MEI document (fermata attributes are
       * attached directly to the containing note-like object)
       * @property {MEI2VF.Fermatas} fermatas
       */
      me.fermatas = new Fermatas(me.systemInfo);
      /**
       * an instance of MEI2VF.Ornaments dealing with and storing all
       * trill elements found in the MEI document
       * @property {MEI2VF.Ornaments} trills
       */
      me.trills = new Ornaments(me.systemInfo);
      /**
       * an instance of MEI2VF.Ties dealing with and storing all ties found in
       * the MEI document
       * @property {MEI2VF.Ties} ties
       */
      me.ties = new Ties(me.systemInfo, me.unresolvedTStamp2);
      /**
       * an instance of MEI2VF.Slurs dealing with and storing all slurs found in
       * the MEI document
       * @property {MEI2VF.Slurs} slurs
       */
      me.slurs = new Slurs(me.systemInfo, me.unresolvedTStamp2);
      /**
       * an instance of MEI2VF.Hairpins dealing with and storing all hairpins
       * found in the MEI document
       * @property {MEI2VF.Hairpins} hairpins
       */
      me.hairpins = new Hairpins(me.systemInfo, me.unresolvedTStamp2);
      /**
       * contains all note-like objects in the current MEI document, accessible
       * by their xml:id
       * @property {Object} notes_by_id
       * @property {Element} notes_by_id.meiNote the XML Element of the note
       * @property {Vex.Flow.StaveNote} notes_by_id.vexNote the VexFlow note
       * object
       */
      me.notes_by_id = {};
      /**
       * the number of the current system
       * @property {Number} currentSystem_n
       */
      me.currentSystem_n = 0;
      /**
       * indicates if a system break is currently to be processed
       * @property {Boolean} pendingSystemBreak
       */
      me.pendingSystemBreak = false;
      /**
       * indicates if a system break is currently to be processed
       * @property {Boolean} pendingSectionBreak
       */
      me.pendingSectionBreak = true;
      /**
       * Contains information about the volta type of the current stave. Properties:
       *
       * -  `start` {String} indicates the number to render to the volta. When
       * falsy, it is assumed that the volta does not start in the current
       * measure
       * -  `end` {Boolean} indicates if there is a volta end in the current
       * measure
       *
       * If null, no volta is rendered
       * @property {Object} currentVoltaType
       */
      me.currentVoltaType = null;
      return me;
    },

    /**
     * Calls {@link #reset} and then processes the specified MEI document or
     * document fragment. The generated objects can
     * be processed further or drawn immediately to a canvas via {@link #draw}.
     * @method process
     * @chainable
     * @param {XMLDocument} xmlDoc an XML document or element containing the MEI music to render
     * @return {Converter} this
     */
    process : function (xmlDoc) {
      var me = this;
      me.reset();

      if (xmlDoc.localName === 'score') {
        me.processScoreChildren(xmlDoc);
      } else {
        me.processScoreChildren(xmlDoc.querySelector('score'));
      }

      //      me.systemInfo.processScoreDef(xmlDoc.getElementsByTagName('scoreDef')[0]);
      //      me.processSections(xmlDoc);
      me.directives.createVexFromInfos(me.notes_by_id);
      me.dynamics.createVexFromInfos(me.notes_by_id);
      me.fermatas.createVexFromInfos(me.notes_by_id);
      me.trills.createVexFromInfos(me.notes_by_id);
      me.ties.createVexFromInfos(me.notes_by_id);
      me.slurs.createVexFromInfos(me.notes_by_id);
      me.hairpins.createVexFromInfos(me.notes_by_id);
      return me;
    },

    /**
     * Draws the internal data objects to a canvas
     * @method draw
     * @chainable
     * @param ctx The canvas context
     * @return {Converter} this
     */
    draw : function (ctx) {
      var me = this;
      me.checkSetContextAndDraw(me.systems, ctx);
      me.setContextAndDraw(me.allBeams, ctx);
      me.setContextAndDraw(me.allTuplets, ctx);
      me.ties.setContext(ctx).draw();
      me.slurs.setContext(ctx).draw();
      me.hairpins.setContext(ctx).draw();
      return me;
    },

    /**
     * Returns the width and the height of the area that contains all drawn
     * staves as per the last processing.
     *
     * @method getStaveArea
     * @return {Object} the width and height of the area that contains all
     * staves.
     * Properties: width, height
     */
    getStaveArea : function () {
      var height;
      height = this.systemInfo.getCurrentLowestY();
      var allVexMeasureStaves = this.getAllVexMeasureStaves();
      var i, k, max_start_x, area_width, stave;
      i = allVexMeasureStaves.length;
      area_width = 0;
      while (i--) {
        if (allVexMeasureStaves[i]) {
          max_start_x = 0;
          // get maximum start_x of all staves in measure
          k = allVexMeasureStaves[i].length;
          while (k--) {
            stave = allVexMeasureStaves[i][k];
            if (stave) {
              max_start_x = Math.max(max_start_x, stave.getNoteStartX());
            }
          }
          k = allVexMeasureStaves[i].length;
          while (k--) {
            // get maximum width of all staves in measure
            stave = allVexMeasureStaves[i][k];
            if (stave) {
              area_width = Math.max(area_width, max_start_x + stave.getWidth());
            }
          }
        }
      }
      return {
        width : area_width,
        height : height
      };
    },

    /**
     * returns a 2d array of all Vex.Flow.Stave objects, arranged by
     * [measure_n][stave_n]
     * @method getAllVexMeasureStaves
     * @return {Vex.Flow.Stave[][]} see {@link #allVexMeasureStaves}
     */
    getAllVexMeasureStaves : function () {
      return this.allVexMeasureStaves;
    },

    /**
     * returns all systems created when processing the MEI document
     * @method getSystems
     * @return {MEI2VF.System[]}
     */
    getSystems : function () {
      return this.systems;
    },

    /**
     * returns all note-like objects created when processing the MEI document
     * @method getNotes
     * @return {Object} for the object properties, see {@link #notes_by_id}
     */
    getNotes : function () {
      return this.notes_by_id;
    },

    /**
     * creates in initializes a new {@link MEI2VF.System} and updates the stave
     * modifier infos
     * @method createNewSystem
     */
    createNewSystem : function () {
      var me = this, system, coords;

      Logger.debug('Converter.createNewSystem()', '{enter}');

      me.pendingSystemBreak = false;
      me.currentSystem_n += 1;

      coords = {
        x : me.printSpace.left,
        y : (me.currentSystem_n === 1) ? me.printSpace.top : me.systemInfo.getCurrentLowestY() + me.cfg.systemSpacing,
        w : me.printSpace.width
      };

      system = new System({
        leftMar : me.systemInfo.getLeftMar(),
        coords : coords,
        staveYs : me.systemInfo.getYs(coords.y),
        labels : me.getStaveLabels(),
        versesCfg : {
          font : me.cfg.lyricsFont,
          maxHyphenDistance : me.cfg.maxHyphenDistance
        }
      });

      if (me.pendingSectionBreak) {
        me.pendingSectionBreak = false;
        me.systemInfo.forceSectionStartInfos();
      } else {
        me.systemInfo.forceStaveStartInfos();
      }

      me.systems[me.currentSystem_n] = system;
      return system;
    },

    processScoreChildren : function (score) {
      var me = this, i, j, childNodes;
      if (score) {
        childNodes = score.childNodes;
        for (i = 0, j = childNodes.length; i < j; i++) {
          if (childNodes[i].nodeType === 1) {
            me.processScoreChild(childNodes[i]);
          }
        }
      } else {
        throw new RuntimeError('No score element found in the document.')
      }
    },

    processScoreChild : function (element) {
      var me = this;
      switch (element.localName) {
        case 'scoreDef' :
          me.systemInfo.processScoreDef(element);
          break;
        case 'staffDef' :
          me.systemInfo.processStaffDef(element);
          break;
        case 'pb' :
          me.onPb(element);
          break;
        case 'ending' :
          me.processEnding(element);
          break;
        case 'section' :
          me.processSection(element);
          break;
        default :
          Logger.info('Not supported', 'Element ' + Util.serializeElement(element) +
                                       ' is not supported in <score>. Ignoring element.');
      }
    },

    //    /**
    //     * @method processSections
    //     */
    //    processSections : function (xmlDoc) {
    //      var me = this, i, j, sections;
    //      sections = xmlDoc.getElementsByTagName('section');
    //      for (i = 0, j = sections.length; i < j; i++) {
    //        me.processSection(sections[i]);
    //      }
    //    },

    /**
     *@method processSection
     */
    processSection : function (element) {
      var me = this, i, j, sectionChildren = element.childNodes;
      for (i = 0, j = sectionChildren.length; i < j; i += 1) {
        if (sectionChildren[i].nodeType === 1) {
          me.processSectionChild(sectionChildren[i]);
        }
      }
    },

    /**
     * @method processEnding
     */
    processEnding : function (element) {
      var me = this, isFirst = true, next, childNode;

      var getNext = function (node) {
        var nextSibling = node.nextSibling;
        while (nextSibling && nextSibling.nodeType !== 1) {
          nextSibling = nextSibling.nextSibling;
        }
        return nextSibling;
      };

      childNode = element.firstChild;
      if (childNode.nodeType !== 1) {
        childNode = getNext(childNode);
      }

      while (childNode) {
        next = getNext(childNode);
        if (isFirst) {
          me.currentVoltaType = {start : element.getAttribute('n')};
          isFirst = false;
        }
        if (!next) {
          me.currentVoltaType.end = true;
        }
        me.processSectionChild(childNode);

        childNode = next;
      }
      me.currentVoltaType = null;
    },

    /**
     * MEI element <b>section</b> may contain (MEI v2.1.0): MEI.cmn: measure
     * MEI.critapp: app MEI.edittrans: add choice corr damage del gap
     * handShift orig reg restore sic subst supplied unclear MEI.shared:
     * annot ending expansion pb sb scoreDef section staff staffDef
     * MEI.text: div MEI.usersymbols: anchoredText curve line symbol
     *
     * Supported elements: <b>ending</b> <b>measure</b> <b>scoreDef</b> <b>section</b> <b>staffDef</b>
     * <b>sb</b>
     * @method processSectionChild
     */
    processSectionChild : function (element) {
      var me = this;
      switch (element.localName) {
        case 'measure' :
          me.processMeasure(element);
          break;
        case 'scoreDef' :
          me.systemInfo.processScoreDef(element);
          break;
        case 'staffDef' :
          me.systemInfo.processStaffDef(element);
          break;
        case 'pb' :
          me.onPb(element);
          break;
        case 'sb' :
          me.onSb(element);
          break;
        case 'ending' :
          me.processEnding(element);
          break;
        case 'section' :
          me.processSection(element);
          break;
        default :
          Logger.info('Not supported', 'Element ' + Util.serializeElement(element) +
                                       ' is not supported in <section>. Ignoring element.');
      }
    },

    setPendingPageBreak : function () {
      Logger.info('setPendingPageBreak() not implemented.')
    },

    /**
     * sets the property {@link #pendingSystemBreak} to `true`. When true, a
     * new system will be initialized when {@link #processMeasure} is called
     * the next time.
     * @method setPendingSystemBreak
     */
    setPendingSystemBreak : function () {
      this.pendingSystemBreak = true;
    },

    /**
     * Processes a MEI measure element and calls functions to process a
     * selection of ancestors: .//staff, ./slur, ./tie, ./hairpin, .//tempo
     * @method processMeasure
     * @param {Element} element the MEI measure element
     */
    processMeasure : function (element) {
      var me = this, atSystemStart, left_barline, right_barline, system, system_n, allDescendants;

      if (me.pendingSectionBreak || me.pendingSystemBreak) {
        system_n = me.systems.length;
        system = me.createNewSystem();
        atSystemStart = true;
      } else {
        system_n = me.systems.length - 1;
        system = me.systems[system_n];
        atSystemStart = false;
      }

      Logger.debug('Converter.processMeasure()', '{enter}');

      left_barline = element.getAttribute('left');
      right_barline = element.getAttribute('right');

      var staveElements = [], dirElements = [], slurElements = [], tieElements = [], hairpinElements = [], tempoElements = [], dynamElements = [], fermataElements = [], trillElements = [], rehElements = [], i, j;

      allDescendants = element.querySelectorAll('*');
      for (i = 0, j = allDescendants.length; i < j; i++) {
        switch (allDescendants[i].localName) {
          case 'staff':
            staveElements.push(allDescendants[i]);
            break;
          case 'dir':
            dirElements.push(allDescendants[i]);
            break;
          case 'tie':
            tieElements.push(allDescendants[i]);
            break;
          case 'slur':
            slurElements.push(allDescendants[i]);
            break;
          case 'hairpin':
            hairpinElements.push(allDescendants[i]);
            break;
          case 'tempo':
            tempoElements.push(allDescendants[i]);
            break;
          case 'dynam':
            dynamElements.push(allDescendants[i]);
            break;
          case 'fermata':
            fermataElements.push(allDescendants[i]);
            break;
          case 'trill':
            trillElements.push(allDescendants[i]);
            break;
          case 'reh':
            rehElements.push(allDescendants[i]);
            break;
          default:
            break;
        }
      }

      // the stave objects will be stored in two places:
      // 1) in each MEI2VF.Measure
      // 2) in MEI2VF.Converter.allVexMeasureStaves
      var staves = me.initializeStavesInMeasure(system, staveElements, left_barline, right_barline, atSystemStart);
      var measureIndex = me.allVexMeasureStaves.push(staves) - 1;

      var currentStaveVoices = new StaveVoices();

      for (i = 0, j = staveElements.length; i < j; i++) {
        me.processStaveEvents(staves, staveElements[i], measureIndex, currentStaveVoices);
      }

      me.directives.createInfos(dirElements, element);
      me.dynamics.createInfos(dynamElements, element);
      me.fermatas.createInfos(fermataElements, element);
      me.trills.createInfos(trillElements, element);
      me.ties.createInfos(tieElements, element, measureIndex, me.systemInfo);
      me.slurs.createInfos(slurElements, element, measureIndex, me.systemInfo);
      me.hairpins.createInfos(hairpinElements, element, measureIndex, me.systemInfo);

      system.addMeasure(new Measure({
        system : system,
        element : element,
        staves : staves,
        voices : currentStaveVoices,
        startConnectorCfg : (atSystemStart) ? {
          labelMode : me.cfg.labelMode,
          models : me.systemInfo.startConnectorInfos,
          staves : staves,
          system_n : me.currentSystem_n
        } : null,
        inlineConnectorCfg : {
          models : me.systemInfo.inlineConnectorInfos,
          staves : staves,
          barline_l : left_barline,
          barline_r : right_barline
        },
        tempoElements : tempoElements,
        rehElements : rehElements,
        tempoFont : me.cfg.tempoFont
      }));
    },

    /**
     * @method initializeStavesInMeasure
     * @param {MEI2VF.System} system the current system
     * @param {Element[]} staveElements all stave elements in the current
     * measure
     * @param {String} left_barline the left barline
     * @param {String} right_barline the right barline
     * @param {Boolean} atSystemStart indicates if the current measure is the system's start measure
     */
    initializeStavesInMeasure : function (system, staveElements, left_barline, right_barline, atSystemStart) {
      var me = this, i, j, stave, stave_n, staves, isFirstVolta = true, clefOffsets = {}, maxClefOffset = 0, keySigOffsets = {}, maxKeySigOffset = 0, precedingMeasureStaves, newClef, currentStaveInfo, element, padding;

      staves = [];

      if (!atSystemStart) {
        precedingMeasureStaves = system.getLastMeasure().getStaves();
      }

      // first run: create MEI2VF.Stave objects, store them in the staves
      // array. Set stave barlines and stave volta. Add clef. Get each stave's
      // clefOffset and calculate the maxClefOffset.
      for (i = 0, j = staveElements.length; i < j; i++) {
        stave_n = parseInt(staveElements[i].getAttribute('n'), 10);
        if (isNaN(stave_n)) {
          throw new RuntimeError(Util.serializeElement(staveElements[i]) +
                                 ' must have an @n attribute of type integer.');
        }

        stave = new Stave({
          system : system,
          y : system.getStaveYs()[stave_n],
          leftBarline : left_barline,
          rightBarline : right_barline
        });
        staves[stave_n] = stave;

        var currentVoltaType = me.currentVoltaType;
        if (isFirstVolta && currentVoltaType) {
          stave.addVoltaFromInfo(currentVoltaType);
        }
        if (precedingMeasureStaves && precedingMeasureStaves[stave_n]) {
          currentStaveInfo = me.systemInfo.getStaveInfo(stave_n);
          newClef = currentStaveInfo.getClef();
          if (currentStaveInfo.showClefCheck()) {
            precedingMeasureStaves[stave_n].addEndClefFromInfo(newClef);
          }
          stave.clef = newClef.type;
          clefOffsets[stave_n] = 0;
          maxClefOffset = 0;
        } else {
          currentStaveInfo = me.systemInfo.getStaveInfo(stave_n);
          if (!currentStaveInfo) {
            throw new RuntimeError(Util.serializeElement(staveElements[i]) + ' refers to stave "' + stave_n +
                                   '", but no corresponding stave definition could be found in the document.');
          }
          if (currentStaveInfo.showClefCheck()) {
            stave.addClefFromInfo(currentStaveInfo.getClef());
          }
          clefOffsets[stave_n] = stave.getModifierXShift();
          maxClefOffset = Math.max(maxClefOffset, clefOffsets[stave_n]);
        }
        isFirstVolta = false;
      }

      // second run: add key signatures; if the clefOffset of a stave is less than
      // maxClefOffset, add padding to the left of the key signature. Get each
      // stave's keySigOffset and calculate the maxKeySigOffset.
      j = staves.length;
      for (i = 0; i < j; i++) {
        stave = staves[i];
        if (stave) {
          if (clefOffsets[i] !== maxClefOffset) {
            padding = maxClefOffset - clefOffsets[i] + 10;
          } else {
            padding = null;
          }
          currentStaveInfo = me.systemInfo.getStaveInfo(i);
          if (currentStaveInfo.showKeysigCheck()) {
            stave.addKeySpecFromInfo(currentStaveInfo.getKeySpec(), padding);
          }
          keySigOffsets[i] = stave.getModifierXShift();
          maxKeySigOffset = Math.max(maxKeySigOffset, keySigOffsets[i]);
        }
      }

      // third run: add time signatures; if the keySigOffset of a stave is
      // less than maxKeySigOffset, add padding to the left of the time signature.
      for (i = 0; i < j; i++) {
        stave = staves[i];
        if (stave) {
          if (keySigOffsets[i] !== maxKeySigOffset) {
            padding = maxKeySigOffset - keySigOffsets[i] + 15;
          } else {
            padding = null;
          }
          currentStaveInfo = me.systemInfo.getStaveInfo(i);
          if (currentStaveInfo.showTimesigCheck()) {
            stave.addTimeSpecFromInfo(currentStaveInfo.getTimeSpec(), padding);
          }
        }
      }

      return staves;
    },

    /**
     * @method getStaveLabels
     */
    getStaveLabels : function () {
      var me = this, labels, i, infos, labelType;
      labels = {};
      if (!me.cfg.labelMode) {
        return labels;
      }
      labelType = (me.cfg.labelMode === 'full' && me.currentSystem_n === 1) ? 'label' : 'labelAbbr';
      infos = me.systemInfo.getAllStaveInfos();
      i = infos.length;
      while (i--) {
        if (infos[i]) {
          labels[i] = infos[i][labelType];
        }
      }
      return labels;
    },

    /**
     * Processes a single stave in a measure
     *
     * @method processStaveEvents
     * @param {Vex.Flow.Stave[]} staves the stave objects in the current
     * measure
     * @param {Element} staveElement the MEI staff element
     * @param {Number} measureIndex the index of the current measure
     * @param {MEI2VF.StaveVoices} currentStaveVoices The current StaveVoices
     * object
     */
    processStaveEvents : function (staves, staveElement, measureIndex, currentStaveVoices) {
      var me = this, stave, stave_n, readEvents, layerElements, i, j, k, l, childElements, vexNotes, staveInfo, event;

      stave_n = parseInt(staveElement.getAttribute('n'), 10) || 1;
      stave = staves[stave_n];

      staveInfo = me.systemInfo.getStaveInfo(stave_n);
      var meter = staveInfo.getTimeSpec();

      layerElements = staveElement.getElementsByTagName('layer');

      var context = {
        /**
         * inBeamNo specifies the number of beams the current events are under
         */
        inBeamNo : 0,
        /**
         * hasStemDirInBeam specifies if a stem.dir has been specified in the current beam
         */
        hasStemDirInBeam : false,
        /**
         * Grace note or grace chord objects to be added to the next non-grace note or chord
         * @property {Vex.Flow.StaveNote[]} graceNoteQueue
         */
        graceNoteQueue : [],
        currentClefChangeProperty : null,
        notes_by_id : me.notes_by_id,
        currentSystem_n : me.currentSystem_n,
        stave : stave,
        stave_n : stave_n
      };

      for (i = 0, j = layerElements.length; i < j; i++) {
        context.layerDir = (j > 1) ? (i === 0 ? VF.StaveNote.STEM_UP : i === j - 1 ? VF.StaveNote.STEM_DOWN : null) : null;
        me.resolveUnresolvedTimestamps(layerElements[i], stave_n, measureIndex, meter);
        staveInfo.checkInitialClef();

        vexNotes = me.processNoteLikeChildren(context, layerElements[i], staveInfo);
        currentStaveVoices.addVoice(me.createVexVoice(vexNotes, meter), stave_n);
      }

      // if there is a clef not yet attached to a note (i.e. the last clef), add it to the last voice
      if (context.currentClefChangeProperty) {
        stave.addEndClefFromInfo(context.currentClefChangeProperty);
        context.currentClefChangeProperty = null;
      }

      staveInfo.removeStartClefCopy();
    },

    /**
     * Creates a new Vex.Flow.Voice
     * @method createVexVoice
     * @param {Array} voiceContents The contents of the voice, an array of
     * tickables
     * @param {Object} meter The meter of the enclosing staff element
     * return {Vex.Flow.Voice}
     */
    createVexVoice : function (voiceContents, meter) {
      var me = this, voice;
      if (!Array.isArray(voiceContents)) {
        throw new RuntimeError('me.createVexVoice() voice_contents argument must be an array.');
      }
      voice = new VF.Voice({
        num_beats : meter.count,
        beat_value : meter.unit,
        resolution : VF.RESOLUTION
      });
      voice.setStrict(false);
      voice.addTickables(voiceContents);
      return voice;
    },

    /**
     * @method resolveUnresolvedTimestamps
     */
    resolveUnresolvedTimestamps : function (layer, stave_n, measureIndex, meter) {
      var me = this, refLocationIndex, i, j, unresolvedTStamp2;
      // check if there's an unresolved TStamp2 reference to this location
      // (measure, staff, layer):
      stave_n = stave_n || 1;
      refLocationIndex = measureIndex + ':' + stave_n + ':' + (parseInt(layer.getAttribute('n'), 10) || '1');
      unresolvedTStamp2 = me.unresolvedTStamp2[refLocationIndex];
      if (unresolvedTStamp2) {
        for (i = 0, j = unresolvedTStamp2.length; i < j; i++) {
          unresolvedTStamp2[i].setContext({
            layer : layer,
            meter : meter
          });
          // TODO: remove eventLink from the list
          unresolvedTStamp2[i] = null;
        }
        // at this point all references should be supplied with context.
        me.unresolvedTStamp2[refLocationIndex] = null;
      }
    },

    processNoteLikeChildren : function (context, element, staveInfo) {
      var me = this, vexNotes = [], k, l, processingResults;

      var childElements = element.childNodes;
      for (k = 0, l = childElements.length; k < l; k++) {
        if (childElements[k].nodeType === 1) {
          processingResults = me.processNoteLikeElement(context, childElements[k], staveInfo);
          if (processingResults) {
            if (Array.isArray(processingResults)) {
              vexNotes = vexNotes.concat(processingResults);
            } else {
              vexNotes.push(processingResults);
            }
          }
        }
      }
      return vexNotes;
    },

    /**
     * processes a note-like element by calling the adequate processing
     * function
     *
     * @method processNoteLikeElement
     * @param {Element} element the element to process
     * @param {MEI2VF.Stave} stave the containing stave
     * @param {Number} stave_n the number of the containing stave
     * @param {VF.StaveNote.STEM_UP|VF.StaveNote.STEM_DOWN|null} layerDir the direction of the current
     * layer
     * @param {MEI2VF.StaveInfo} staveInfo the stave info object
     */
    processNoteLikeElement : function (context, element, staveInfo) {
      var me = this;
      switch (element.localName) {
        case 'rest' :
          return me.processRest(context, element, staveInfo);
        case 'mRest' :
          return me.processMRest(context, element, staveInfo);
        case 'space' :
          return me.processSpace(context, element);
        case 'note' :
          return me.processNote(context, element, staveInfo);
        case 'beam' :
          return me.processBeam(context, element, staveInfo);
        case 'tuplet' :
          return me.processTuplet(context, element, staveInfo);
        case 'chord' :
          return me.processChord(context, element, staveInfo);
        case 'clef' :
          return me.processClef(context, element, staveInfo);
        case 'bTrem' :
          return me.processBTrem(context, element, staveInfo);
        case 'anchoredText' :
          me.processAnchoredText(context, element, staveInfo);
          return;
        default :
          Logger.info('Not supported', 'Element "' + element.localName + '" is not supported. Ignoring element.');
      }
    },

    processAnchoredText : function (context, element, staveInfo) {
    },

    /**
     * @method processNote
     */
    processNote : function (context, element, staveInfo) {
      var me = this, xml_id, mei_tie, mei_slur, mei_stave_n, atts, note_opts, note, clef, vexPitch;

      atts = Util.attsToObj(element);

      mei_tie = atts.tie;
      mei_slur = atts.slur;

      xml_id = MeiLib.XMLID(element);

      try {

        vexPitch = EventUtil.getVexPitch(element);

//        mei_stave_n = +atts.staff || stave_n;
        //        if (mei_stave_n !== stave_n) {
//          var otherStave = me.allVexMeasureStaves[me.allVexMeasureStaves.length - 1][mei_stave_n];
//          if (otherStave) {
//            stave = otherStave;
//            clef = me.systemInfo.getClef(stave_n);
//          } else {
//            Logger.warn('Staff not found', 'No stave could be found which corresponds to @staff="' + mei_stave_n +
//                                           '" specified in ' + Util.serializeElement(element) +
//                                           '". Adding note to current stave.');
//          }
//        }

        if (!clef) {
          clef = staveInfo.getClef();
        }

        note_opts = {
          vexPitch : vexPitch,
          clef : clef,
          element : element,
          atts : atts,
          stave : context.stave,
          layerDir : context.layerDir
        };

        note = (atts.grace) ? new GraceNote(note_opts) : new Note(note_opts);

        if (note.hasMeiStemDir && context.inBeamNo > 0) {
          context.hasStemDirInBeam = true;
        }

        me.processSyllables(note, element, context.stave_n);


        //        // FIXME For now, we'll remove any child nodes of <note>
        //        while (element.firstChild) {
        //          element.removeChild(element.firstChild);
        //        }

        if (mei_tie) {
          me.processAttrTie(mei_tie, xml_id, vexPitch, context.stave_n);
        }
        if (mei_slur) {
          me.processSlurAttribute(mei_slur, xml_id);
        }

        context.notes_by_id[xml_id] = {
          meiNote : element,
          vexNote : note,
          system : context.currentSystem_n,
          layerDir : context.layerDir
        };

        if (context.currentClefChangeProperty) {
          EventUtil.addClefModifier(note, context.currentClefChangeProperty);
          context.currentClefChangeProperty = null;
        }

        if (atts.grace) {
          context.graceNoteQueue.push(note);
          return;
        } else {
          if (context.graceNoteQueue.length > 0) {
            note.addModifier(0, new VF.GraceNoteGroup(context.graceNoteQueue, false).beamNotes());
            context.graceNoteQueue = [];
          }
        }
        return note;

      } catch (e) {
        throw new RuntimeError('A problem occurred processing ' + Util.serializeElement(element) +
                               '\nORIGINAL ERROR MESSAGE: ' + e.toString());
      }
    },

    /**
     * @method processChord
     */
    processChord : function (context, element, staveInfo) {
      var me = this, noteElements, xml_id, chord, chord_opts, atts, i, j;

      noteElements = element.getElementsByTagName('note');

      atts = Util.attsToObj(element);

      xml_id = MeiLib.XMLID(element);

      try {

        chord_opts = {
          noteElements : noteElements,
          clef : staveInfo.getClef(),
          stave : context.stave,
          element : element,
          atts : atts,
          layerDir : context.layerDir
        };

        chord = (atts.grace) ? new GraceChord(chord_opts) : new Chord(chord_opts);

        if (chord.hasMeiStemDir && context.inBeamNo > 0) {
          context.hasStemDirInBeam = true;
        }

        var allNoteIndices = [];

        for (i = 0, j = noteElements.length; i < j; i++) {
          me.processNoteInChord(context, i, noteElements[i], element, chord);
          allNoteIndices.push(i);
        }

        context.notes_by_id[xml_id] = {
          meiNote : element,
          vexNote : chord,
          index : allNoteIndices,
          system : context.currentSystem_n,
          layerDir : context.layerDir
        };

        if (context.currentClefChangeProperty) {
          EventUtil.addClefModifier(chord, context.currentClefChangeProperty);
          context.currentClefChangeProperty = null;
        }

        if (atts.grace) {
          context.graceNoteQueue.push(chord);
          return;
        } else {
          if (context.graceNoteQueue.length > 0) {
            chord.addModifier(0, new VF.GraceNoteGroup(context.graceNoteQueue, false).beamNotes());
            context.graceNoteQueue = [];
          }
        }
        return chord;
      } catch (e) {
        var xmlString = Util.serializeElement(element);
        for (i = 0, j = noteElements.length; i < j; i++) {
          xmlString += '\n    ' + Util.serializeElement(noteElements[i]);
        }
        throw new RuntimeError('A problem occurred processing \n' + xmlString + '\n</chord>\n: ' + e.toString());
      }
    },

    /**
     * @method processNoteInChord
     */
    processNoteInChord : function (context, chordIndex, element, chordElement, chord) {
      var me = this, i, j, atts, xml_id;

      atts = Util.attsToObj(element);

      var vexPitch = EventUtil.getVexPitch(element);

      xml_id = MeiLib.XMLID(element);

      if (atts.tie) {
        me.processAttrTie(atts.tie, xml_id, vexPitch, context.stave_n);
      }
      if (atts.slur) {
        me.processSlurAttribute(atts.slur, xml_id);
      }

      context.notes_by_id[xml_id] = {
        meiNote : chordElement,
        vexNote : chord,
        index : [chordIndex],
        system : context.currentSystem_n,
        layerDir : context.layerDir
      };

      var childNodes = element.childNodes;
      for (i = 0, j = childNodes.length; i < j; i++) {
        switch (childNodes[i].localName) {
          case 'accid':
            atts.accid = childNodes[i].getAttribute('accid');
            break;
          case 'artic':
            EventUtil.addArticulation(chord, childNodes[i]);
            break;
          default:
            break;
        }
      }

      if (atts.accid) {
        EventUtil.processAttrAccid(atts.accid, chord, chordIndex);
      }
      if (atts.fermata) {
        EventUtil.addFermata(chord, element, atts.fermata, chordIndex);
      }
    },

    /**
     * @method processRest
     */
    processRest : function (context, element, staveInfo) {
      var rest, xml_id;
      try {

        rest = new Rest({
          element : element,
          stave : context.stave,
          clef : (element.hasAttribute('ploc') && element.hasAttribute('oloc')) ? staveInfo.getClef() : null
        });

        xml_id = MeiLib.XMLID(element);

        if (context.currentClefChangeProperty) {
          EventUtil.addClefModifier(rest, context.currentClefChangeProperty);
          context.currentClefChangeProperty = null;
        }

        context.notes_by_id[xml_id] = {
          meiNote : element,
          vexNote : rest,
          system : context.currentSystem_n
        };
        return rest;
      } catch (e) {
        console.log(e);
        throw new RuntimeError('A problem occurred processing ' + Util.serializeElement(element));
      }
    },

    /**
     * @method processMRest
     */
    processMRest : function (context, element, staveInfo) {
      var mRest, xml_id;

      try {
        var mRestOpts = {
          meter : staveInfo.getTimeSpec(),
          element : element,
          stave : context.stave,
          clef : (element.hasAttribute('ploc') && element.hasAttribute('oloc')) ? staveInfo.getClef() : null
        };

        mRest = new MRest(mRestOpts);

        xml_id = MeiLib.XMLID(element);

        context.notes_by_id[xml_id] = {
          meiNote : element,
          vexNote : mRest,
          system : context.currentSystem_n
        };
        return mRest;
      } catch (e) {
        throw new RuntimeError('A problem occurred processing ' + Util.serializeElement(element));
      }
    },

    /**
     * @method processSpace
     */
    processSpace : function (context, element) {
      var space = null;
      if (element.hasAttribute('dur')) {
        try {
          space = new Space({ element : element, stave : context.stave });
        } catch (e) {
          throw new RuntimeError('A problem occurred processing ' + Util.serializeElement(element));
        }
      } else {
        Logger.info('@dur expected', 'No duration attribute in ' + Util.serializeElement(element) +
                                     '". Ignoring element.');
      }
      return space;
    },

    /**
     * @method processClef
     * @param {Element} element the MEI clef element
     * @param {Stave} stave the containing stave
     * @param {Number} stave_n the number of the containing stave
     * @param {VF.StaveNote.STEM_UP|VF.StaveNote.STEM_DOWN|null} layerDir the direction of the current
     * layer
     * @param {StaveInfo} staveInfo the stave info object
     */
    processClef : function (context, element, staveInfo) {
      context.currentClefChangeProperty = staveInfo.clefChangeInMeasure(element);
    },

    /**
     * @method processBTrem
     * @param {Element} element the element
     * @param {MEI2VF.Stave} stave the containing stave
     * @param {Number} stave_n the number of the containing stave
     * @param {VF.StaveNote.STEM_UP|VF.StaveNote.STEM_DOWN|null} layerDir the direction of the current layer
     * @param {MEI2VF.StaveInfo} staveInfo
     */
    processBTrem : function (context, element, staveInfo) {
      var me = this;

      Logger.info('Not implemented', 'Element <bTrem> not implemented. Processing child nodes.');

      return me.processNoteLikeChildren(context, element, staveInfo);

    },

    /**
     * @method processBeam
     * @param {Element} element the MEI beam element
     * @param {MEI2VF.Stave} stave the containing stave
     * @param {Number} stave_n the number of the containing stave
     * @param {VF.StaveNote.STEM_UP|VF.StaveNote.STEM_DOWN|null} layerDir the direction of the current layer
     * @param {MEI2VF.StaveInfo} staveInfo
     */
    processBeam : function (context, element, staveInfo) {
      var me = this, vexNotes, childElements, k, l;
      context.inBeamNo += 1;

      vexNotes = me.processNoteLikeChildren(context, element, staveInfo);

      // TODO remove filter later and modify beam object to skip objects other than note and clef
      var filteredElements = vexNotes.filter(function (element) {
        return element.beamable === true;
      });

      // set autostem parameter of VF.Beam to true if neither layerDir nor any stem direction in the beam is specified

      if (vexNotes.length > 0) {
        try {
          me.allBeams.push(new VF.Beam(filteredElements, !context.layerDir && !context.hasStemDirInBeam));
        } catch (e) {
          Logger.error('VexFlow Error', 'An error occurred processing ' + Util.serializeElement(element) + ': "' +
                                        e.toString() + '". Ignoring beam.');
        }
      }

      context.inBeamNo -= 1;
      if (context.inBeamNo === 0) {
        context.hasStemDirInBeam = false;
      }
      return vexNotes;
    },

    /**
     * Processes an MEI <b>tuplet</b>.
     * Supported attributes:
     *
     * - num (3 if not specified)
     * - numbase (2 if not specified)
     * - num.format ('count' if not specified)
     * - bracket.visible (auto if not specified)
     * - bracket.place (auto if not specified)
     *
     * @method processTuplet
     * @param {Element} element the MEI tuplet element
     * @param {MEI2VF.Stave} stave the containing stave
     * @param {Number} stave_n the number of the containing stave
     * @param {VF.StaveNote.STEM_UP|VF.StaveNote.STEM_DOWN|null} layerDir the direction of the current
     * layer
     * @param {MEI2VF.StaveInfo} staveInfo the stave info object
     */
    processTuplet : function (context, element, staveInfo) {
      var me = this, vexNotes, tuplet, bracketPlace;

      vexNotes = me.processNoteLikeChildren(context, element, staveInfo);

      if (vexNotes.length === 0) {
        Logger.warn('Missing content', 'Not content found in ' + Util.serializeElement(element) +
                                       '". Ignoring tuplet.');
        return;
      }

      tuplet = new VF.Tuplet(vexNotes, {
        num_notes : parseInt(element.getAttribute('num'), 10) || 3,
        beats_occupied : parseInt(element.getAttribute('numbase'), 10) || 2
      });

      if (element.getAttribute('num.format') === 'ratio') {
        tuplet.setRatioed(true);
      }

      tuplet.setBracketed(element.getAttribute('bracket.visible') === 'true');

      bracketPlace = element.getAttribute('bracket.place');
      if (bracketPlace) {
        tuplet.setTupletLocation((bracketPlace === 'above') ? 1 : -1);
      }

      me.allTuplets.push(tuplet);
      return vexNotes;
    },

    /**
     * @method processAttrTie
     */
    processAttrTie : function (mei_tie, xml_id, vexPitch, stave_n) {
      var me = this, i, j;
      for (i = 0, j = mei_tie.length; i < j; ++i) {
        if (mei_tie[i] === 't' || mei_tie[i] === 'm') {
          me.ties.terminateTie(xml_id, {
            vexPitch : vexPitch,
            stave_n : stave_n
          });
        }
        if (mei_tie[i] === 'i' || mei_tie[i] === 'm') {
          me.ties.startTie(xml_id, {
            vexPitch : vexPitch,
            stave_n : stave_n
          });
        }
      }
    },

    /**
     * @method processSlurAttribute
     */
    processSlurAttribute : function (mei_slur, xml_id) {
      var me = this, tokens, token, i, j;
      if (mei_slur) {
        // create a list of { letter, num }
        tokens = me.parseSlurAttribute(mei_slur);
        for (i = 0, j = tokens.length; i < j; i++) {
          token = tokens[i];
          if (token.letter === 't') {
            me.slurs.terminateSlur(xml_id, {
              nesting_level : token.nesting_level
            });
          }
          if (token.letter === 'i') {
            me.slurs.startSlur(xml_id, {
              nesting_level : token.nesting_level
            });
          }
        }
      }
    },

    /**
     * @method parseSlurAttribute
     */
    parseSlurAttribute : function (slur_str) {
      var result = [], numbered_tokens, numbered_token, i, j, num;
      numbered_tokens = slur_str.split(' ');
      for (i = 0, j = numbered_tokens.length; i < j; i += 1) {
        numbered_token = numbered_tokens[i];
        if (numbered_token.length === 1) {
          result.push({
            letter : numbered_token,
            nesting_level : 0
          });
        } else if (numbered_token.length === 2) {
          num = +numbered_token[1];
          if (!num) {
            throw new RuntimeError('badly formed slur attribute');
          }
          result.push({
            letter : numbered_token[0],
            nesting_level : num
          });
        } else {
          throw new RuntimeError('badly formed slur attribute');
        }
      }
      return result;
    },

    /**
     * @method processSyllables
     */
    processSyllables : function (note, element, stave_n) {
      var me = this, i, j, syllables, vexSyllable;
      syllables = element.getElementsByTagName('syl');
      for (i = 0, j = syllables.length; i < j; i++) {
        vexSyllable = new Syllable(syllables[i], me.cfg.lyricsFont);
        note.addAnnotation(0, vexSyllable);
        me.systems[me.currentSystem_n].verses.addSyllable(vexSyllable, syllables[i], stave_n);
      }
    },

    setContextAndDraw : function (items, ctx) {
      var i, j;
      for (i = 0, j = items.length; i < j; i++) {
        items[i].setContext(ctx).draw();
      }
    },

    checkSetContextAndDraw : function (items, ctx) {
      var i, j;
      for (i = 0, j = items.length; i < j; i++) {
        if (items[i]) {
          items[i].format(ctx).draw(ctx);
        }
      }
    }

  };

  return Converter;

});