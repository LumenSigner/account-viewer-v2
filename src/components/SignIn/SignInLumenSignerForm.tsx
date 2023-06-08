import { useEffect, useState } from "react";
import { Button, InfoBlock, Modal } from "@stellar/design-system";

import { BipPathInput } from "components/BipPathInput";
import { WalletModalContent } from "components/WalletModalContent";

import { defaultStellarBipPath } from "constants/settings";
import { ActionStatus, AuthType, ModalPageProps } from "types/types";
import QRCode from "react-qr-code";
import { Result } from "@zxing/library";

import { QrReader } from "react-qr-reader";
import { useRedux } from "hooks/useRedux";
import { useDispatch } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { logEvent } from "helpers/tracking";
import { resetAccountAction, fetchAccountAction } from "ducks/account";
import { useErrorMessage } from "hooks/useErrorMessage";
import { Keypair } from "stellar-sdk";
import { storeKeyAction } from "ducks/keyStore";
import { updateSettingsAction } from "ducks/settings";
import { KeyType } from "@stellar/wallet-sdk";
import { ErrorMessage } from "components/ErrorMessage";

export const SignInLumenSignerForm = ({ onClose }: ModalPageProps) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { account } = useRedux("account");
  const { status, isAuthenticated, errorString, data } = account;
  const accountId = data?.id;

  const [showRequestAddressView, setShowRequestAddressView] = useState(false);
  const [showReceiveAddressView, setShowReceiveAddressView] = useState(false);

  const [lumenSignerBipPath, setLumenSignerBipPath] = useState(
    defaultStellarBipPath,
  );

  const { errorMessage, setErrorMessage } = useErrorMessage({
    initialMessage: errorString,
    onUnmount: () => {
      dispatch(resetAccountAction());
    },
  });

  useEffect(() => {
    if (status === ActionStatus.SUCCESS) {
      if (isAuthenticated && accountId) {
        navigate({
          pathname: "/dashboard",
          search: location.search,
        });
        dispatch(updateSettingsAction({ authType: AuthType.LUMENSIGNER }));
        dispatch(
          storeKeyAction({
            publicKey: accountId,
            keyType: KeyType.ledger, // TODO: add lumensigner key type
            path: lumenSignerBipPath,
          }),
        );
        logEvent("login: connected with LumenSigner");
      } else {
        setErrorMessage("Something went wrong, please try again.");
        logEvent("login: saw connect with LumenSigner error", {
          message: errorString,
        });
      }
    }
  }, [
    status,
    isAuthenticated,
    setErrorMessage,
    dispatch,
    accountId,
    errorString,
    navigate,
    location.search,
    lumenSignerBipPath,
  ]);

  const goToRequestAddressView = () => {
    setShowRequestAddressView(true);
  };

  const goToReceiveAddressView = () => {
    setShowRequestAddressView(false);
    setShowReceiveAddressView(true);
  };

  const handleSignIn = (result: Result) => {
    setErrorMessage("");

    const qrData = result.getText();
    const isValidData = qrData.match("^address;m/44'/148'/\\d+';[A-Z0-9]{56}$");
    if (!isValidData) {
      setErrorMessage("Invalid QR code");
      logEvent("login: saw connect with lumensigner error", {
        message: `Invalid QR code, data: ${qrData}`,
      });
      return;
    }

    const [command, bipPath, publicKey] = qrData.split(";");

    let isValidPublicKey = true;
    try {
      Keypair.fromPublicKey(publicKey);
    } catch (e) {
      isValidPublicKey = false;
    }

    if (
      command !== "address" ||
      `m/${lumenSignerBipPath}` !== bipPath ||
      !isValidPublicKey
    ) {
      setErrorMessage("Invalid QR code");
      logEvent("login: saw connect with lumensigner error", {
        message: `Invalid QR code, data: ${qrData}`,
      });
      return;
    }
    dispatch(fetchAccountAction(publicKey));
  };

  return (
    <>
      {!showRequestAddressView && !showReceiveAddressView && (
        <WalletModalContent
          type="lumensigner"
          buttonFooter={
            <>
              <Button onClick={goToRequestAddressView}>
                Connect with LumenSigner
              </Button>
              <Button onClick={onClose} variant={Button.variant.secondary}>
                Cancel
              </Button>
            </>
          }
        >
          <BipPathInput
            id="lumensigner"
            value={lumenSignerBipPath}
            onValueChange={(val) => setLumenSignerBipPath(val)}
          />
        </WalletModalContent>
      )}

      {showRequestAddressView && (
        <>
          <Modal.Heading>Connect with LumenSigner</Modal.Heading>

          <InfoBlock>
            <p>Please use your LumenSigner to scan the QR code below.</p>
          </InfoBlock>

          <Modal.Body>
            <div
              style={{
                height: "auto",
                margin: "0 auto",
                maxWidth: 256,
                width: "100%",
                marginTop: "1.5rem",
              }}
            >
              <QRCode
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                value={`request-address;m/${lumenSignerBipPath}`}
              />
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button onClick={goToReceiveAddressView}>Continue</Button>
          </Modal.Footer>
        </>
      )}

      {showReceiveAddressView && (
        <>
          <Modal.Heading>Connect with LumenSigner</Modal.Heading>

          <InfoBlock>
            <p>
              After you authorize on LumenSigner, a QR code will appear on the
              screen of LumenSigner. Please hold it up to your device's camera.
            </p>
          </InfoBlock>

          <Modal.Body>
            <QrReader
              onResult={(result) => {
                if (result) {
                  handleSignIn(result);
                }
              }}
              containerStyle={{
                height: "auto",
                margin: "0 auto",
                maxWidth: 256,
                width: "100%",
              }}
              constraints={{ facingMode: "user" }}
            />
            <ErrorMessage message={errorMessage} textAlign="center" />
          </Modal.Body>
        </>
      )}
    </>
  );
};
