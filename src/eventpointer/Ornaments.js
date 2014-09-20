define([
  'vexflow',
  'm2v/core/Logger',
  'm2v/core/Util',
  'm2v/core/RuntimeError',
  'm2v/core/Tables',
  'm2v/eventpointer/EventPointerCollection'
], function (VF, Logger, Util, RuntimeError, Tables, EventPointerCollection, undefined) {

  /**
   * @class MEI2VF.Ornaments
   * @extend MEI2VF.PointerCollection
   * @private
   *
   * @constructor
   */
  var Ornaments = function (systemInfo, font) {
    this.init(systemInfo, font);
  };

  Vex.Inherit(Ornaments, EventPointerCollection, {

    init : function (systemInfo, font) {
      Ornaments.superclass.init.call(this, systemInfo, font);
    },

    createVexFromInfos : function (notes_by_id) {
      var me = this, i, model, note, annot;
      i = me.allModels.length;
      while (i--) {
        model = me.allModels[i];
        note = notes_by_id[model.startid];
        if (note) {
          me.addOrnamentToNote(note.vexNote, model);
        } else {
          console.log(model);
          Logger.log('warn', 'Input error', Util.serializeElement(model.element) +
                                            ' could not be rendered because the reference "' + model.startid +
                                            '" could not be resolved.');
        }
      }
    },

    /**
     * adds an ornament to a note-like object
     * @method addOrnamentToNote
     * @param {Vex.Flow.StaveNote} note the note-like VexFlow object
     * @param {Object} model the data model
     * @param {Number} index The index of the note in a chord (optional)
     */
    addOrnamentToNote : function (note, model, index) {
      var atts = model.atts, accidLower, accidUpper;
      // TODO support @tstamp2 etc -> make Link instead of Pointer

      var vexOrnament = new VF.Ornament("tr");

      if (atts.accidupper) {
        vexOrnament.setUpperAccidental(Tables.accidentals[atts.accidupper]);
      }
      if (atts.accidlower) {
        vexOrnament.setLowerAccidental(Tables.accidentals[atts.accidlower]);
      }

      // TODO support position below
      //      vexOrnament.setPosition(Tables.positions[model.atts.place]);
      vexOrnament.setPosition(VF.Modifier.Position.ABOVE);

      note.addModifier(index || 0, vexOrnament);
    }
  });


  return Ornaments;

});