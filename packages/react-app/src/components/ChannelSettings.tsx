import React from "react";

import styled, { css } from 'styled-components';
import {Section, Content, Item, ItemH, ItemBreak, H1, H2, H3, Image, P, Span, Anchor, Button, Showoff, FormSubmision, Input, TextField} from 'components/SharedStyling';
import { BsFillImageFill } from 'react-icons/bs';
import { FiLink } from 'react-icons/fi';

import Dropdown from 'react-dropdown';
import 'react-dropdown/style.css';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.min.css';
import Loader from 'react-loader-spinner';

import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import { useWeb3React, UnsupportedChainIdError } from '@web3-react/core';

import { addresses, abis } from "@project/contracts";
import { CloseIcon } from 'assets/icons';
import EPNSCoreHelper from 'helpers/EPNSCoreHelper';
import CryptoHelper from 'helpers/CryptoHelper';
const ethers = require('ethers');

const ipfs = require('ipfs-api')();

// Set Notification Form Type | 0 is reserved for protocol storage
const NFTypes = [
  { value: "1", label: 'Broadcast (IPFS Payload)' },
  { value: "2", label: 'Secret (IPFS Payload)' },
  { value: "3", label: 'Targetted (IPFS Payload)' },
  { value: "4", label: 'Subset (IPFS Payload)' },
];
const LIMITER_KEYS = ['Enter', ','];


// Create Header
function ChannelSettings() {
  const { active, error, account, library, chainId } = useWeb3React();

  const [nfProcessing, setNFProcessing] = React.useState(0);

  const [nfRecipient, setNFRecipient] = React.useState('');
  const [multipleRecipients, setMultipleRecipients] = React.useState([]);
  const [tempRecipeint, setTempRecipient] = React.useState(''); // to temporarily hold the address of one recipient who would be entered into the recipeints array above.
  const [nfType, setNFType] = React.useState('');

  const [nfSub, setNFSub] = React.useState('');
  const [nfSubEnabled, setNFSubEnabled] = React.useState(false);

  const [nfMsg, setNFMsg] = React.useState('');

  const [nfCTA, setNFCTA] = React.useState('');
  const [nfCTAEnabled, setNFCTAEnabled] = React.useState(false);

  const [nfMedia, setNFMedia] = React.useState('');
  const [nfMediaEnabled, setNFMediaEnabled] = React.useState(false);

  const [nfInfo, setNFInfo] = React.useState('');

  // on change for the subset type notifications input
  const handleSubsetInputChange = (e) => {
    // if the user enters in a comma or an enter then seperate the addresses
    if(LIMITER_KEYS.includes(e.key)){
      e.preventDefault();
      // if they enter a limiter key, then add the temp value to the recipeints list
      // then clear the value of the temp text
      setMultipleRecipients((oldRecipients) =>(
        // use this combination to remove duplicates
        Array.from(new Set([
        ...oldRecipients,
        tempRecipeint
        ]))
      ));
      setTempRecipient('');
    }
  };
  // when to remove a subscriber
  const removeRecipient = (recipientAddress) => {
    const filteredRecipients = multipleRecipients.filter(rec => rec !== recipientAddress);
    setMultipleRecipients(filteredRecipients);
  };

  React.useEffect(() => {
    const broadcastIds = ["1", "4"]; //id's of notifications which qualify as broadcast
    setMultipleRecipients([]); //reset array when type changes/
    if (broadcastIds.includes(nfType)) {
      // This is broadcast, nfRecipient will be the same
      setNFRecipient(account);
    }
    else {
      setNFRecipient('');
    }
  }, [nfType]);

  // validate the body being sent, return true if no errors
  const bodyValidated = (notificationToast) => {
    let validated = true;
    // if we are sending for a subset and there 
    if(nfType === "4" && !multipleRecipients.length){
      toast.update(notificationToast, {
        render: "Please enter at least two recipients in order to use subset notifications type",
        type: toast.TYPE.ERROR,
        autoClose: 5000
      });
      validated = false; 
    }
    return validated;
  }

  const handleSendMessage = async (e) => {
    // Check everything in order
    e.preventDefault();

    // Toastify
    let notificationToast = toast.dark(<LoaderToast msg="Preparing Notification" color="#fff"/>, {
      position: "bottom-right",
      autoClose: false,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });

    // do some validation
    if(!bodyValidated(notificationToast)) return;

    // Set to processing
    setNFProcessing(1);

    // Form signer and contract connection
    var signer = library.getSigner(account);
    let contract = new ethers.Contract(addresses.epnscore, abis.epnscore, signer);

    // For payload basic
    let nsub = nfSub;
    let nmsg = nfMsg;
    let secretEncrypted;

    let asub = nfSub;
    let amsg = nfMsg;
    let acta = nfCTA;
    let aimg = nfMedia;

    // Decide type and storage
    switch (nfType) {
      // Broadcast Notification
      case "1":
        break;

      // Targetted Notification
      case "3":
        break;

      // Secret Notification
      case "2":
        // Create secret
        let secret = CryptoHelper.makeid(14);

        // Encrypt payload and change sub and nfMsg in notification
        nsub = "You have a secret message!";
        nmsg = "Open the app to see your secret message!";

        // get public key from EPNSCoreHelper
        let k = await EPNSCoreHelper.getPublicKey(nfRecipient, contract);
        if (k == null) {
          // No public key, can't encrypt
          setNFInfo("Public Key Registration is required for encryption!");
          setNFProcessing(2);

          toast.update(notificationToast, {
            render: "Unable to encrypt for this user, no public key registered",
            type: toast.TYPE.ERROR,
            autoClose: 5000
          });

          return;
        }

        let publickey = k.toString().substring(2);
        //console.log("This is public Key: " + publickey);

        secretEncrypted = await CryptoHelper.encryptWithECIES(secret, publickey);
        asub = CryptoHelper.encryptWithAES(nfSub, secret);
        amsg = CryptoHelper.encryptWithAES(nfMsg, secret);
        acta = CryptoHelper.encryptWithAES(nfCTA, secret);
        aimg = CryptoHelper.encryptWithAES(nfMedia, secret);
        break;
  
      // Targetted Notification
      case "4":
        break;

      default:
        break;
    }

    // Handle Storage
    let storagePointer = '';

    // IPFS PAYLOAD --> 1, 2, 3
    if (nfType === "1" || nfType === "2" || nfType === "3" || nfType === "4") {
      // Checks for optional fields
      if (nfSubEnabled && isEmpty(nfSub)) {
        setNFInfo("Enter Subject or Disable it");
        setNFProcessing(2);

        toast.update(notificationToast, {
          render: "Incorrect Payload",
          type: toast.TYPE.ERROR,
          autoClose: 5000
        });

        return;
      }

      if (nfMediaEnabled && isEmpty(nfMedia)) {
        setNFInfo("Enter Media URL or Disable it");
        setNFProcessing(2);

        toast.update(notificationToast, {
          render: "Incorrect Payload",
          type: toast.TYPE.ERROR,
          autoClose: 5000
        });
        return;
      }

      if (nfCTAEnabled && isEmpty(nfCTA)) {
        setNFInfo("Enter Call to Action Link or Disable it");
        setNFProcessing(2);

        toast.update(notificationToast, {
          render: "Incorrect Payload",
          type: toast.TYPE.ERROR,
          autoClose: 5000
        });
        return;
      }

      if (isEmpty(nfMsg)) {
        setNFInfo("Message cannot be empty");
        setNFProcessing(2);

        toast.update(notificationToast, {
          render: "Incorrect Payload",
          type: toast.TYPE.ERROR,
          autoClose: 5000
        });
        return;
      }

      const jsonPayload = {
        "notification": {
          "title": nsub,
          "body": nmsg
        },
        "data": {
          "type": nfType,
          "secret": secretEncrypted,
          "asub": asub,
          "amsg": amsg,
          "acta": acta,
          "aimg": aimg
        }
      };

      // if we are sending a subset type, then include recipients
      if(nfType === "4"){
        jsonPayload["recipients"] = [...multipleRecipients];
      }
      console.log('\n\n\n\n\n\n');
      console.log(jsonPayload);
      console.log('\n\n\n\n\n\n');

      const input = JSON.stringify(jsonPayload);

      console.log("Uploding to IPFS...");
      toast.update(notificationToast, {
        render: "Uploding to IPFS...",
      });

      const ipfs = require("nano-ipfs-store").at("https://ipfs.infura.io:5001");

      try {
        storagePointer = await ipfs.add(input);
      }
      catch (e) {
        setNFProcessing(2);
        setNFInfo("IPFS Upload Error");
      }

      console.log ("IPFS cid: %o", storagePointer);
      toast.update(notificationToast, {
        render: "IPFS HASH: " + storagePointer,
      });

    }

    // Prepare Identity and send notification
    const identity = nfType + "+" + storagePointer;
    const identityBytes = ethers.utils.toUtf8Bytes(identity);

    var anotherSendTxPromise = contract.sendNotification(nfRecipient, identityBytes);

    console.log ("Sending Transaction... ");
    toast.update(notificationToast, {
      render: "Sending Transaction...",
    });

    anotherSendTxPromise
      .then(async (tx) => {
        console.log(tx);
        console.log ("Transaction Sent!");

        toast.update(notificationToast, {
          render: "Transaction Sent",
          type: toast.TYPE.INFO,
          autoClose: 5000
        });

        await tx.wait(1);
        console.log ("Transaction Mined!");

        setNFProcessing(2);
        setNFType('');
        setNFInfo("Notification Sent");

        toast.update(notificationToast, {
          render: "Transaction Mined / Notification Sent",
          type: toast.TYPE.SUCCESS,
          autoClose: 5000
        });
      })
      .catch(err => {
        console.log("!!!Error handleSendMessage() --> %o", err);
        setNFInfo("Transaction Failed, please try again");

        toast.update(notificationToast, {
          render: "Transacion Failed: " + err,
          type: toast.TYPE.ERROR,
          autoClose: 5000
        });
      });
  }

  const isEmpty = (field) => {
    if (field.trim().length == 0) {
      return true;
    }

    return false;
  }

  // toast customize
  const LoaderToast = ({ msg, color }) => (
    <Toaster>
      <Loader
       type="Oval"
       color={color}
       height={30}
       width={30}
      />
      <ToasterMsg>{msg}</ToasterMsg>
    </Toaster>
  )

  const getChannelData=async(contract,channel)=>{
    return new Promise ((resolve, reject) => {
      console.log(contract,channel)
      // To get channel info from a channel address
      contract.channels(channel)
        .then(response => {

          console.log("getChannelInfo() --> %o", response);
          resolve(response.poolContribution);
        })
        .catch(err => {
          console.log("!!!Error, getChannelInfo() --> %o", err);
          reject(err);
        });
    })
  }

  return (
    <>
      <Section>
        <Content padding="10px 10px">
          <Item align="flex-end">
          <ChannelActionButton onClick={async()=>{
    // var signer = library.getSigner(account);
    // let contract = new ethers.Contract(addresses.epnscore, abis.epnscore, signer);

    // var channelData=await getChannelData(contract,signer._address);

    // var poolContribution=EPNSCoreHelper.formatBigNumberToMetric(channelData, true);

    // var amountToBeConverted = parseInt(poolContribution)-10;

    // console.log("Amount To be converted==>",amountToBeConverted)

    console.log("CALLING API");

  //   const params = {
  //     buyToken: 'DAI',
  //     sellToken: 'ETH',
  //     sellAmount: '1000000000000000000', // Always denominated in wei
  //     // includedSources: 'Uniswap' // Exclude uniswap and kyber
  // };
  

  const response = await fetch(
    `https://api.0x.org/swap/v1/quote?buyToken=DAI&sellToken=PUSH&sellAmount=40&includedSources=Uniswap`
);

const res=await response.json()

console.log('res',res)

  

          }}><ActionTitle>Deactivate Channel</ActionTitle></ChannelActionButton>
          </Item>
        </Content>
      </Section>
    </>
  );
}

// css styles
const Toaster = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 0px 10px;
`

const ActionTitle = styled.span`
  ${ props => props.hideit && css`
    visibility: hidden;
  `};
`

const ToasterMsg = styled.div`
  margin: 0px 10px;
`

const DropdownStyledParent = styled.div `
  .is-open {
    margin-bottom: 130px;
  }
`

const MultiRecipientsContainer = styled.div`
  width: 100%;
  padding: 0px 20px;
  padding-top: 10px;
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  gap: 7px 15px;
  
  span {
    color: white;
    background: #e20880;
    padding: 6px 10px;
    border-radius: 5px;

    i{
      cursor: pointer;
      margin-left: 25px;
    }
  }
`;
const Parent = styled(Section)`
padding:20px;
margin:0px 20px 0px 20px;`

const DropdownStyled = styled(Dropdown)`

  .Dropdown-control {
    background-color: #000;
    color: #fff;
    padding: 12px 52px 12px 10px;
    border: 1px solid #000;
    border-radius: 4px;
  }

  .Dropdown-placeholder {
    text-transform: uppercase;
    font-weight: 400;
    letter-spacing: 0.2em;
    font-size: 0.8em;
  }

  .Dropdown-arrow {
    top: 18px;
    bottom: 0;
    border-color: #fff transparent transparent;
  }

  .Dropdown-menu {
    border: 1px solid #000;
    box-shadow: none;
    background-color: #000;
    border-radius: 0px;
    margin-top: -3px;
    border-bottom-right-radius: 4px;
    border-bottom-left-radius: 4px;
  }

  .Dropdown-option {
    background-color: rgb(35 35 35);
    color: #ffffff99;

    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-size: 0.7em;
    padding: 15px 20px;
  }

  .Dropdown-option:hover {
    background-color: #000000;
    color: #fff;
  }
`

const ChannelActionButton = styled.button`
  border: 0;
  outline: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 15px;
  margin: 10px;
  color: #fff;
  border-radius: 5px;
  font-size: 14px;
  font-weight: 400;
  position: relative;
  background-color:#674C9F;
  &:hover {
    opacity: 0.9;
    cursor: pointer;
    pointer: hand;
  }
  &:active {
    opacity: 0.75;
    cursor: pointer;
    pointer: hand;
  }
`


// Export Default
export default ChannelSettings;
