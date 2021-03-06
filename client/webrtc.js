/************************
* WebRTC Control Class
*************************/
let uuid;
let localStream;
let peerConnection;
let serverConnection;
let eventStream;

let streamVideoTrack;
let streamAudioTrack;
let videoSender;
let audioSender;

// ICE Server Candidates
const peerConnectionConfig = {
    'iceServers':
    [
        {'urls': 'stun:stun.stunprotocol.org:3478'},
        {'urls': 'stun:stun.l.google.com:19302'},
    ]
};

// WebRTC Constructor
function WebRtc(inputStream){
  localStream = inputStream;
  uuid = createUUID();

  this.socketConnect();

  peerConnection = new RTCPeerConnection(peerConnectionConfig);

  streamVideoTrack = inputStream.getVideoTracks()[0];
  streamAudioTrack = inputStream.getAudioTracks()[0];

  if(streamVideoTrack != undefined)
    videoSender = peerConnection.addTrack(streamVideoTrack, inputStream);
  if(streamAudioTrack != undefined)
    audioSender = peerConnection.addTrack(streamAudioTrack, inputStream);

  peerConnection.onicecandidate = gotIceCandidate;
  peerConnection.ontrack = gotRemoteStream;
}

// Start Websocket
WebRtc.prototype.socketConnect = function() {
  serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
  serverConnection.onmessage = gotMessageFromServer;
}

// if peer connection is closed, make peer connection
WebRtc.prototype.peerConnect = function() {
  resetPeerConnect();
}

// start WebRtc by calling start
WebRtc.prototype.start = function() {
  startCalling();
}

// stop WebRtc
WebRtc.prototype.stop = function() {
  serverConnection.send(JSON.stringify({'type': 'CLOSEWEBRTC'}));
  peerConnection.close();
}

// change stream
WebRtc.prototype.applyStream = function(inputStream) {
  if(audioSender != undefined)  // Check If Stream Exists; if yes, replace old track with new track
  {
    audioSender.replaceTrack(inputStream.getAudioTracks()[0]);
  }
  if(videoSender != undefined)  // Check If Stream Exists; if yes, replace old track with new track
  {
    videoSender.replaceTrack(inputStream.getVideoTracks()[0]);
  }

  remoteVideo.srcObject = eventStream;
}

function startCalling()
{
    setPeerConnection(localStream);
}

// Make Peer Connection
function setPeerConnection(inputStream){
  peerConnection.createOffer().then(createdDescription).catch(errorHandler);
}

function gotMessageFromServer(message)
{
    if(!peerConnection) startCalling(false);

    let signal = JSON.parse(message.data);

    if(signal.uuid == uuid) return;

    if(signal.sdp)
    {
        //console.log("closeedddd", peerConnection.connectionState);
        if(peerConnection.connectionState === 'closed')
        {
          resetPeerConnect();
        }
        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function() {
            // Only create answers in response to offers
            if(signal.sdp.type == 'offer')
            {
                toggleWebRtc("AUTOSTART");
                peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
            }
        }).catch(errorHandler);
    }
    else if(signal.ice)
    {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
    }
    else if(signal.type === "CLOSEWEBRTC")
    {
        if(isWebRtcActivated)
        {
          toggleButton(webrtcToggle);
          isWebRtcActivated = false;
        }
        peerConnection.close();
    }
}

function gotIceCandidate(event)
{
    if(event.candidate != null)
    {
        serverConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': uuid}));
    }
}


function createdDescription(description)
{
    peerConnection.setLocalDescription(description).then(function() {
        serverConnection.send(JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid}));
    }).catch(errorHandler);
}

// once receives stream, apply it to remoteVideo
function gotRemoteStream(event)
{
    remoteVideo.pause();
    eventStream = event.streams[0];
    remoteVideo.srcObject = eventStream;
    streamVisualizerForRemoteVideo.apply(eventStream); // apply new stream to Remote Video Visualizer
}

// restart peerconnection
function resetPeerConnect()
{
  if(peerConnection.connectionState === 'closed')
  {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);

    streamVideoTrack = localStream.getVideoTracks()[0];
    streamAudioTrack = localStream.getAudioTracks()[0];

    if(streamVideoTrack != undefined)
      videoSender = peerConnection.addTrack(streamVideoTrack, localStream);
    if(streamAudioTrack != undefined)
      audioSender = peerConnection.addTrack(streamAudioTrack, localStream);

    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;
  }
}

function errorHandler(error)
{
    console.log(error);
}

// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID()
{
    function s4()
    {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
