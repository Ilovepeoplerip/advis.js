import React, { Component } from 'react';
import {createCompRows, drawImage, drawCAM} from './ui.js';
import * as model from './model.js';
import {Table, TableHeader, TableHeaderColumn, TableBody, TableRow, Paper, Slider} from 'material-ui';
import {IMAGENET_CLASSES} from '../models/mobilenet/imagenet_classes';
import '../App.css';
// import * as dl from 'deeplearn';
// import * as dl from '@tensorflow/tfjs';



const imgStyle = {
  height: 224,
  width: 224,
  margin: 10,
  textAlign: 'center',
  display: 'inline-block',
};

const CANVAS_WIDTHpx = '227px';
const CANVAS_HEIGHTpx = '227px';
const CANVAS_WIDTH = 227;
const CANVAS_HEIGHT = 227;
class Display extends Component {
  constructor(props) {
    super(props);
    this.state = {
      srcImageArr: '',
      srcImage: this.props.srcImage,
      cImg: '',
      cCam: '',
      results: [],
      order: 0,
      disableSlider: this.props.disableSlider,
      sliderValue: 0,
      lastSelectedRow: []
    };
  }

  drawCAM = (e) => {
    console.log("drawCAM")
    console.log(e);
    this.state.lastSelectedRow = e;
    if (e.length !== 0) {
        let ar = Object.assign([], IMAGENET_CLASSES);
        let row = this.state.results[e[0]];
        let index = ar.indexOf(row.key);
        drawCAM(this.state.cImg,
                this.props.net,
                this.state.activation,
                this.state.cCam,
                index);
    } else {
        const ctx = this.state.cCam.getContext('2d');
        ctx.clearRect(0, 0, 227, 227);
    }
  };

  orderChanged = (e, row, column) => {
    if (column === 2) {
      if (this.state.order) {
        e.target.innerHTML = 'Confidence %';
      } else {
        e.target.innerHTML = '↓ Confidence %';
      }
      this.changeOrder(!this.state.order);
      this.setState({
        order: !this.state.order
      });
    }
  };

  changeOrder = (val) => {
    let classes = null;
    if (!val) {
      classes = Array.from(this.props.topK.keys());
    }
    const ctx = this.state.cImg.getContext('2d');
    let imgData = ctx.getImageData(0,0,this.state.cImg.width,this.state.cImg.height);
    model.predict(this.state.cImg, this.props.net, classes, function(top, activation) {
      let rows = createCompRows(top, this.props.topK);
      this.setState({
          results: rows,
          activation: activation
      });
    }.bind(this));
  };

  componentDidMount() {
    console.log("componentDidMount");
    const ctx = this.state.cImg.getContext('2d');
    drawImage(ctx, this.state.srcImage, function() {
      let curImgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      model.predict(curImgData, this.props.net, null, function(top, activation) {
        let rows = createCompRows(top, null);
        this.setState({
          results: rows,
          activation: activation
        });
      }.bind(this));
    }.bind(this));
  }

  componentWillReceiveProps(nProps) {
    let classes = null;
    if (!this.state.order) {
      classes = Array.from(this.props.topK.keys());
    }
    if (nProps.reset || nProps.srcImage !== this.state.srcImage) {
      let ctx = this.state.cCam.getContext('2d');
      ctx.clearRect(0, 0, 227, 227);
      ctx = this.state.cImg.getContext('2d');
      drawImage(ctx, nProps.image, function() {
        let curImgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        model.predict(curImgData, nProps.net, null, function(top, activation) {
          let rows = createCompRows(top, null);
          this.setState({
            results: rows,
            activation: activation,
            cam: [-1]
          });
        }.bind(this));
      }.bind(this));
      // inject TFJS gradient code
      // let adv = model.get_adv_xs(batch, batch.labels, batch.xs, 0.5);
    }
    this.props = nProps;
  }

  handleSlider = (event, eps) => {
    console.log("handleSlider");
    this.setState({sliderValue: eps});

    const ctx = this.state.cImg.getContext('2d');
    if (this.state.srcImageArr === '') {
      console.log('First eps change. Saving the original image.');
      this.state.srcImageArr = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
    }

    let perturbedImgArr = model.generateAdversarialImage(this.props.net,
                                                         this.state.srcImageArr,
                                                         eps);
    let perturbedImgData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    perturbedImgData.data.set(perturbedImgArr);
    ctx.putImageData(perturbedImgData, 0, 0);

    model.predict(perturbedImgData, this.props.net, null, function(top, activation) {
      let rows = createCompRows(top, null);
      this.setState({
        results: rows,
        activation: activation
      });
    }.bind(this));

    const ctxCAM = this.state.cCam.getContext('2d');
    ctxCAM.clearRect(0, 0, 227, 227);
    this.drawCAM(this.state.lastSelectedRow);

   };

  render() {

    const epsMax = 100;
    const epsMin = 0;
    const sliderOn = this.state.disableSlider ? (
      <div></div>
    ) : (
      <div>
        <Slider min={epsMin}
                max={epsMax}
                onChange={this.handleSlider}
                defaultValue={this.state.sliderValue}
                className="sliderStyle" />
        <div className="epsLabel">
          Epsilon: {this.state.sliderValue}
        </div>
      </div>
    );

    return (
      <div id="halfColumn">
        <div className="overlay">
          <Paper style={imgStyle} zDepth={3}>
            <canvas height="227px"
                    width="227px"
                    ref={cImg => this.state.cImg = cImg}>
            </canvas>
            <canvas id="heatmap"
                    height="227px"
                    width="227px"
                    ref={cCam => this.state.cCam = cCam}>
            </canvas>
          </Paper>
          {sliderOn}
        </div>
        <Table className="table"
               onRowSelection={this.drawCAM}>
          <TableHeader adjustForCheckbox={false}
                       displaySelectAll={false}>
            <TableRow className="header-row"
                      onCellClick={(e, f, g) => this.orderChanged(e, f, g)}>
              <TableHeaderColumn>Class</TableHeaderColumn>
              <TableHeaderColumn style={{textAlign: 'right',
                                         cursor: 'pointer'}}>
                Confidence %
              </TableHeaderColumn>
              <TableHeaderColumn style={{textAlign: 'right'}}>
                Absolute % Change
              </TableHeaderColumn>
            </TableRow>
          </TableHeader>
          <TableBody displayRowCheckbox={false}
                     showRowHover={true}
                     deselectOnClickaway={false}>
            {this.state.results}
          </TableBody>
        </Table>
      </div>
    );
  }
}

export default Display;