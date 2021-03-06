import React from "react";
import { Grid, Icon, Segment, Button, Header, Modal } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css'
import { getApiUrl, postHttpRequest } from "../utility"
import toastr from 'toastr';
import 'toastr/build/toastr.min.css';

class Driver extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            counter: 0,
            dropDownType: [],
            phase: 1,
            activeCluster: "",
            activeClusterId: "",
            activeClusterData: [],
            activeBlockLabel: "",
            activeBlockData: [],
            setOTPModalOpen: false,
            opt: "",
            notActionReasons: [
                {
                    label: "Not Contactable"
                },
                {
                    label: "Incorrect Address"
                },
                {
                    label: "Requested Another Time"
                }
            ],
            deliveryType: null,
            isLogin: true,
            userData: {
                //taking the userId from the local storage and converting it to a number type
                // if its a non primitive data type you have to do JSON.parse()
                user_id: Number(window.localStorage.getItem("userId"))
            },
            tempTourData: [],
            viewOTPAtDriverEnd: ''
        }
    }


    componentDidMount() {
        //network call their to fetch dropdown types
        // this postRequest gets the url and return some data
        this.getClusterName()
    }

    getClusterName = () => {
        postHttpRequest(getApiUrl('getClusterName', 'api/v1/'), {
            driverID: this.state.userData['user_id']
        })
            .then(res => {
                if (res.status && res.data && res.data.length > 0) {
                    this.setState({
                        dropDownType: res.data
                    }, () => {
                        this.fetchLatestUserdata()
                    })
                } else {
                    toastr.info(res['message'])
                }
            })
    }

    openActiveCluster = (label) => {
        // fetch blocks based on cluster (the one on which user has clicked)
        postHttpRequest(getApiUrl('getBlockName', 'api/v1/'), {
            tour_id: label.id,
            driverID: this.state.userData["user_id"]
        })
            .then(res => {
                let dataToSet = {
                    activeCluster: label.label,
                    activeClusterId: label.id,
                    activeClusterObj: label,
                    phase: 2,
                    activeClusterData: []
                }
                if (res.status && res.data) {
                    let allData = []
                    Object.keys(res.data).forEach(x => {
                        allData.push({
                            blockName: x,
                            jobs: res.data[x].length,
                            latLng: res.data[x].length ? res.data[x][0]['receiver_lat'] + "," + res.data[x][0]['receiver_long'] : "",
                            otherData: res.data[x]
                        })
                    })
                    dataToSet['activeClusterData'] = allData
                    dataToSet['tempTourData'] = res['tempData']
                }
                this.setState(dataToSet)
            })
    }

    openActiveBlock = (elem) => {
        // fetch jobs based on a block name
        postHttpRequest(getApiUrl('getJobBasedOnBlock', 'api/v1/'), {
            request_id: elem.otherData.map(x => x["id"])
        })
            .then(res => {
                let dataToSet = {
                    activeBlockLabel: elem.blockName,
                    phase: 3,
                    activeBlockData: [],
                }
                if (res.status && res.data && res.data.length) {
                    dataToSet['activeBlockData'] = res.data.map(x => {
                        let newNameToDisplay = "Blk " + x['receiver_block_num']
                        if (x['receiver_road_name']) {
                            newNameToDisplay += " " + x['receiver_road_name']
                        }
                        if (x['receiver_floor']) {
                            newNameToDisplay += " #" + x['receiver_floor']
                        }
                        if (x['receiver_unit_number']) {
                            newNameToDisplay += "-" + x['receiver_unit_number']
                        }
                        return {
                            ...x,
                            address: newNameToDisplay,
                            latLng: x['receiver_lat'] + "," + x['receiver_long'],
                            jobId: x['id'],
                            phoneNumber: x['receiver_contact'],
                            type: this.state.tempTourData.find(y => y['request_id'] === x['id'])['request_type']
                        }
                    })
                }
                this.setState(dataToSet)
            })
    }

    handleStateChange = (type, value) => {
        this.setState({
            [type]: value
        })
    }

    submitOTP = () => {
        if (!this.state.otp) {
            toastr.error("OTP is Required")
            return false
        }
        if (this.state.otp.length !== 4) {
            toastr.error("OTP should be of length 4")
            return false
        }
        // make an api call at bakckend
        // you have to send this.state.otp and this.state.jobId
        // on success
        postHttpRequest(getApiUrl('otpValidtor', 'api/v1/'), {
            jobId: this.state.activeJob.jobId,
            otp: this.state.otp,
            typeOfCode: this.state.activeJob.type === 'Pickup' ? "pickup_code" : "delivery_code"
        })
            .then(res => {
                if (res.status) {
                    toastr.success("Request has been delivered", "OTP is Valid")
                    this.setState({
                        setOTPModalOpen: false,
                        viewOTPAtDriverEnd: ''
                    }, () => {
                        this.getLatestJobs()
                    })
                } else {
                    toastr.error(res.message)
                }
            })
    }

    submitReason = (job) => {
        if (!this.state.reason) {
            return false
        }
        postHttpRequest(getApiUrl('unsuccessfulDelivery', 'api/v1/'), {
            request_id: job.jobId,
            reason: this.state.reason
        })
            .then(res => {
                if (res.status) {
                    toastr.success("JOB Marked As Incomplete")
                    this.setState({
                        setOtherActionsModalOpen: false
                    }, () => {
                        this.getLatestJobs()
                    })
                }
            })
    }

    openPopupForOtp = async (job) => {
        if (job.type !== 'Pickup') {
            if (job.status !== '5') {
                toastr.info("JOb is NOt Ready to Deliver")
                return false
            }
        }
        let tempOTP = ''
        let result = await postHttpRequest(getApiUrl('otpGenerator', 'api/v1/'), {
            jobId: job.jobId,
            typeOfCode: job.type === 'Pickup' ? "pickup_code" : "delivery_code",
            showOTP: job.type === 'Pickup' ? true : false
        })
        if (result && result['status']) {
            tempOTP = result.otp
        } else {
            toastr.error(result['message'])
            return;
        }
        this.setState({
            type: job.type,
            setOTPModalOpen: true,
            viewOTPAtDriverEnd: tempOTP,
            otp: "",
            activeJob: job
        })
    }

    getLatestJobs = () => {
        postHttpRequest(getApiUrl('getBlockName', 'api/v1/'), {
            tour_id: this.state.activeClusterId,
            driverID: this.state.userData["user_id"]
        })
            .then(res => {
                if (res['status']) {
                    if (res['data'] && res['data'][this.state.activeBlockLabel]) {
                        this.openActiveBlock({
                            blockName: this.state.activeBlockLabel,
                            otherData: res['data'][this.state.activeBlockLabel]
                        })
                    } else {
                        this.openActiveCluster(this.state.activeClusterObj)
                    }
                } else {
                    this.gobackPhase1()
                }
            })
    }

    markAvailable = () => {
        // function to mark availability
        postHttpRequest(getApiUrl('availability', 'api/v1/'), {
            availability: !this.state.userData['availability'],
            driverID: this.state.userData["user_id"]
        })
            .then(res => {
                if (res.status) {
                    if (!this.state.userData['availability']) {
                        toastr.success("You are online")
                    } else {
                        toastr.error("You are offline")
                    }
                    this.setState({
                        userData: {
                            ...this.state.userData,
                            availability: !this.state.userData['availability']
                        }
                    }, () => {
                        this.fetchLatestUserdata()
                    })
                }
            })
    }

    fetchLatestUserdata = () => {
        postHttpRequest(getApiUrl('getDriverDetails', 'api/v1/'), {
            driverID: this.state.userData["user_id"]
        })
            .then(res => {
                if (res.status) {
                    this.setState({ userData: res.data })
                }
            })
    }

    gobackPhase1 = () => {
        this.setState({
            activeCluster: "",
            activeClusterId: "",
            activeClusterObj: {},
            phase: 1,
            activeClusterData: []
        }, () => {
            this.getClusterName()
        })
    }

    gobackPhase2 = () => {
        this.setState({
            activeBlockLabel: "",
            phase: 2,
            activeBlockData: []
        }, () => {
            this.openActiveCluster(this.state.activeClusterObj)
        })
    }

    readyToDeliver = (jobID) => {
        console.log(jobID)
        postHttpRequest(getApiUrl('incrementStatus', 'api/v1/'), {
            jobID: jobID
        })
            .then(res => {
                if (res.status) {
                    toastr.success("Item is Ready To Deliver Now")
                    this.getLatestJobs()
                }
            })
    }

    render() {
        return (<div style={{ marginTop: "30px" }}>
            <Grid container stackable as="h1">
                <Grid.Column >
                    {this.state.phase === 1 && <>
                        {this.state.dropDownType.length > 0 && this.state.dropDownType.map(x => {
                            return (
                                <Segment className="ui top aligned">{x.label}
                                    <button onClick={() => this.openActiveCluster(x)} className="ui right floated button"><Icon name="angle double right" /></button> </Segment>

                            )
                        })}<div><Button id="powerButton" onClick={() => this.markAvailable()} className="ui right aligned" basic color={this.state.userData['availability'] === true ? 'green' : 'red'}><Icon id="powerButtonIcon" class="center aligned" name="power" /></Button></div></>
                    }
                    {
                        this.state.phase === 2 && <>
                            <button onClick={() => this.gobackPhase1()}><Icon name="angle double left" /></button>
                            {this.state.activeCluster}
                            {this.state.activeClusterData.length > 0 && this.state.activeClusterData.map(x => {
                                return (
                                    <Segment className="ui top aligned">
                                        <a target="__blank" href={`https://maps.google.com/maps?q=${x.latLng}`}>{x.blockName}</a>
                                        <br />
                                        {`${x.jobs} jobs in it`}
                                        <button onClick={() => this.openActiveBlock(x)} className="ui right floated button"><Icon name="angle double right" /></button> </Segment>
                                )
                            })}
                            <Button id="powerButton" onClick={() => this.markAvailable()} className="ui right aligned" basic color={this.state.userData['availability'] === true ? 'green' : 'red'}><Icon id="powerButtonIcon" class="center aligned" name="power" /></Button>
                        </>
                    }
                    {
                        this.state.phase === 3 && <>
                            <button onClick={() => this.gobackPhase2()}><Icon name="angle double left" /></button>
                            {this.state.activeBlockData.length > 0 && this.state.activeBlockData.map(x => {
                                return (
                                    <Segment.Group horizontal>
                                        <Segment>Ref. ID: #{x.jobId}<br />

                                            Recipient: {x.receiver_name}<br />
                                        Address: {x.address}<br />
                                        Special Instructions: {x.special_instructions}
                                        </Segment>
                                        <Segment>
                                            <div>
                                                <Button floated="right" basic color='olive'>{x.type}</Button><br />


                                                <>
                                                    <Modal
                                                        onClose={() => this.handleStateChange('setOTPModalOpen', true)}
                                                        onOpen={() => this.openPopupForOtp(x)}
                                                        open={this.state.setOTPModalOpen}
                                                        trigger={<Button floated="right"><Icon className="unlock"></Icon>{x.type === "Pickup" ? "Give OTP" : "Get OTP"}</Button>}
                                                    >

                                                        {this.state.type && this.state.type.match(/delivery/gi) && <Modal.Content>
                                                            <Modal.Description>
                                                                <Header>Enter OTP To Continue</Header>
                                                                <input type='tel' minLength="4" maxLength="4" value={this.state.otp} onChange={(e) => this.handleStateChange(e.target.name, e.target.value)} required name="otp" />
                                                            </Modal.Description>
                                                        </Modal.Content>}

                                                        {this.state.type && this.state.type.match(/pickup/gi) && <Modal.Content>
                                                            <Modal.Description>
                                                                <Header>OTP</Header>
                                                                <div>Pickup OTP: {this.state.viewOTPAtDriverEnd}</div>
                                                            </Modal.Description>
                                                        </Modal.Content>}

                                                        <Modal.Actions>
                                                            <Button color='red' onClick={() => this.handleStateChange('setOTPModalOpen', false)}>
                                                                cancel
        </Button>
                                                            {this.state.type && this.state.type.match(/delivery/gi) && <Button color='blue' onClick={() => this.submitOTP(x)}>
                                                                Submit
        </Button>}

                                                        </Modal.Actions>
                                                    </Modal>
                                                </><br />
                                                <a href={`tel:${x.phoneNumber}`}><Button floated="right" basic color='black'>
                                                    <Icon className="phone"></Icon> Call
    </Button></a><br />
                                                <>
                                                    <Modal
                                                        onClose={() => this.handleStateChange('setOtherActionsModalOpen', false)}
                                                        onOpen={() => this.handleStateChange('setOtherActionsModalOpen', true)}
                                                        open={this.state.setOtherActionsModalOpen}
                                                        trigger={<Button floated="right"><Icon className="user cancel"></Icon>Unable to deliver</Button>}
                                                    >
                                                        <Modal.Content>
                                                            <Modal.Description>
                                                                {this.state.notActionReasons.map(x => {
                                                                    return (
                                                                        <>
                                                                            <input type='radio' name='reason' value={x.label} onChange={(e) => this.handleStateChange(e.target.name, x.label)} /> {x.label} <br />
                                                                        </>
                                                                    )
                                                                })}
                                                            </Modal.Description>
                                                        </Modal.Content>
                                                        <Modal.Actions>
                                                            <Button color='red' onClick={() => this.handleStateChange('setOtherActionsModalOpen', false)}>
                                                                Cancel
        </Button>
                                                            <Button color='blue'
                                                                onClick={() => this.submitReason(x)}> Submit </Button>
                                                        </Modal.Actions>
                                                    </Modal>
                                                    <br />
                                                    {x.status === '4' &&
                                                        <Button floated="right" basic color='green' onClick={() => this.readyToDeliver(x.id)}>Ready To Deliver</Button>
                                                    }
                                                </>
                                            </div>
                                        </Segment>


                                    </Segment.Group>
                                )
                            })}
                        </>
                    }
                </Grid.Column>
            </Grid>
        </div >)
    }
}

export default Driver;
