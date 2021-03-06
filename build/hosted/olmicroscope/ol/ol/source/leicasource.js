goog.provide('ol.source.Leica');

goog.require('goog.asserts');
goog.require('ol');
goog.require('ol.ImageTile');
goog.require('ol.TileCoord');
goog.require('ol.TileState');
goog.require('ol.TileUrlFunction');
goog.require('ol.dom');
goog.require('ol.proj');
goog.require('ol.source.TileImage');
goog.require('ol.tilegrid.Zoomify');


/**
 * @enum {string}
 */
ol.source.LeicaTierSizeCalculation = {
  DEFAULT: 'default',
  TRUNCATED: 'truncated'
};



/**
 * @classdesc
 * Layer source for tile data in Leica format.
 *
 * @constructor
 * @extends {ol.source.TileImage}
 * @param {olx.source.LeicaOptions=} opt_options Options.
 * @api
 */
ol.source.Leica = function(opt_options) {

  var options = goog.isDef(opt_options) ? opt_options : {};

  var size = options.size;
  var tierSizeCalculation = goog.isDef(options.tierSizeCalculation) ?
      options.tierSizeCalculation :
      ol.source.LeicaTierSizeCalculation.DEFAULT;

  var imageWidth = size[0];
  var imageHeight = size[1];
  var tierSizeInTiles = [];
//  var tileSize = ol.DEFAULT_TILE_SIZE;
  var tileSizeBase = 512;
  var tileSize = tileSizeBase;

  switch (tierSizeCalculation) {
    case ol.source.LeicaTierSizeCalculation.DEFAULT:
      while (imageWidth > tileSize || imageHeight > tileSize) {
        tierSizeInTiles.push([
          Math.ceil(imageWidth / tileSize),
          Math.ceil(imageHeight / tileSize)
        ]);
        tileSize += tileSize;
      }
      break;
    case ol.source.ZoomifyTierSizeCalculation.TRUNCATED:
      var width = imageWidth;
      var height = imageHeight;
      while (width > tileSize || height > tileSize) {
        tierSizeInTiles.push([
          Math.ceil(width / tileSize),
          Math.ceil(height / tileSize)
        ]);
        width >>= 1;
        height >>= 1;
      }
      break;
    default:
      goog.asserts.fail();
      break;
  }

  tierSizeInTiles.push([1, 1]);
  tierSizeInTiles.reverse();

  var resolutions = [1];
  var tileCountUpToTier = [0];
  var i, ii;
  for (i = 1, ii = tierSizeInTiles.length; i < ii; i++) {
    resolutions.push(1 << i);
    tileCountUpToTier.push(
        tierSizeInTiles[i - 1][0] * tierSizeInTiles[i - 1][1] +
        tileCountUpToTier[i - 1]
    );
  }
  resolutions.reverse();

  var tileGrid = new ol.tilegrid.Zoomify({
    resolutions: resolutions,
    tileSize: tileSizeBase
  });

  var url = options.url;
  var tileUrlFunction = ol.TileUrlFunction.withTileCoordTransform(
      tileGrid.createTileCoordTransform({extent: [0, 0, size[0], size[1]]}),
      /**
       * @this {ol.source.TileImage}
       * @param {ol.TileCoord} tileCoord Tile Coordinate.
       * @param {number} pixelRatio Pixel ratio.
       * @param {ol.proj.Projection} projection Projection.
       * @return {string|undefined} Tile URL.
       */
      function(tileCoord, pixelRatio, projection) {
        if (goog.isNull(tileCoord)) {
          return undefined;
        } else {
          
          var tileCoordZ = tileCoord[0];
          var tileCoordX = tileCoord[1];
          var tileCoordY = tileCoord[2];

          var tileIndex = tileCoordX +
              tileCoordY * tierSizeInTiles[tileCoordZ][0] +
              tileCountUpToTier[tileCoordZ];
          
          var tileGroup = (tileIndex / ol.DEFAULT_TILE_SIZE) | 0;
          var scale = Math.pow(2, tileGrid.getMaxZoom() - tileCoordZ);
          var x_pos = tileCoordX * tileGrid.getTileSize(0);
          var y_pos = tileCoordY * tileGrid.getTileSize(0);
          return url + '?' + x_pos + '+' + y_pos + '+' + tileGrid.getTileSize(0) +
              '+' + tileGrid.getTileSize(0) + '+' + scale + '+' + '80+s';
        }
      });

  goog.base(this, {
    attributions: options.attributions,
    crossOrigin: options.crossOrigin,
    logo: options.logo,
    tileClass: ol.source.LeicaTile_,
    tileGrid: tileGrid,
    tileUrlFunction: tileUrlFunction
  });

};
goog.inherits(ol.source.Leica, ol.source.TileImage);



/**
 * @constructor
 * @extends {ol.ImageTile}
 * @param {ol.TileCoord} tileCoord Tile coordinate.
 * @param {ol.TileState} state State.
 * @param {string} src Image source URI.
 * @param {?string} crossOrigin Cross origin.
 * @param {ol.TileLoadFunctionType} tileLoadFunction Tile load function.
 * @private
 */
ol.source.LeicaTile_ = function(
    tileCoord, state, src, crossOrigin, tileLoadFunction) {

  goog.base(this, tileCoord, state, src, crossOrigin, tileLoadFunction);

  /**
   * @private
   * @type {Object.<string,
   *                HTMLCanvasElement|HTMLImageElement|HTMLVideoElement>}
   */
  this.leicaImageByContext_ = {};

};
goog.inherits(ol.source.LeicaTile_, ol.ImageTile);


/**
 * @inheritDoc
 */
ol.source.LeicaTile_.prototype.getImage = function(opt_context) {
  // var tileSize = ol.DEFAULT_TILE_SIZE;

  var tileSize = 512;

  var key = goog.isDef(opt_context) ? goog.getUid(opt_context).toString() : '';
  if (key in this.leicaImageByContext_) {
    return this.leicaImageByContext_[key];
  } else {
    var image = goog.base(this, 'getImage', opt_context);
    if (this.state == ol.TileState.LOADED) {
      if (image.width == tileSize && image.height == tileSize) {
        this.leicaImageByContext_[key] = image;
        return image;
      } else {
        var context = ol.dom.createCanvasContext2D(tileSize, tileSize);
        context.drawImage(image, 0, 0);
        this.leicaImageByContext_[key] = context.canvas;
        return context.canvas;
      }
    } else {
      return image;
    }
  }
};
