import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { BigNumber } from "bignumber.js";
import {
  Button,
  InfoBlock,
  TextLink,
  Modal,
  Icon,
  Identicon,
} from "@stellar/design-system";

import { LabelAndValue } from "components/LabelAndValue";

import { getMemoTypeText } from "helpers/getMemoTypeText";
import { logEvent } from "helpers/tracking";
import { sendTxAction, updateSendTxStatus } from "ducks/sendTx";
import { useRedux } from "hooks/useRedux";
import { ActionStatus, AuthType, PaymentFormData } from "types/types";
import { Networks } from "stellar-sdk";
import QRCode from "react-qr-code";
import { QrReader } from "react-qr-reader";
import { Result } from "@zxing/library";
import { AccountIsUnsafe } from "./WarningMessages/AccountIsUnsafe";

interface ConfirmTransactionProps {
  formData: PaymentFormData;
  maxFee: string;
  onSuccessfulTx: () => void;
  onFailedTx: () => void;
  onBack: () => void;
}

export const ConfirmTransaction = ({
  formData,
  maxFee,
  onSuccessfulTx,
  onFailedTx,
  onBack,
}: ConfirmTransactionProps) => {
  const { sendTx, settings } = useRedux("sendTx", "keyStore", "settings");
  const { lumenSignerSettings } = useRedux("lumenSignerSettings");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transactionPart, setTransactionPart] = useState("");
  const [inReadSignatureProcess, setInReadSignatureProcess] = useState(false);

  const [lumenSignerTxData, setLumenSignerTxData] = useState<string[]>([]);

  const { account } = useRedux("account");
  const { data } = account;
  const accountId = data?.id;

  const { status, errorString } = sendTx;

  const dispatch = useDispatch();

  useEffect(() => {
    logEvent("send: saw confirmation screen");
  }, []);

  useEffect(() => {
    if (status === ActionStatus.SUCCESS) {
      onSuccessfulTx();
      logEvent("send: saw send success message");
    }

    if (status === ActionStatus.ERROR) {
      onFailedTx();
      logEvent("send: saw send error message", {
        message: errorString,
      });
    }
  }, [status, onSuccessfulTx, onFailedTx, errorString]);

  useEffect(() => {
    console.log("lumenSignerTxData: ", lumenSignerTxData);
    const intervalId = setInterval(() => {
      const totalPieces = lumenSignerTxData.length;
      setCurrentIndex((prevIndex: number) => (prevIndex + 1) % totalPieces);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [lumenSignerTxData]);

  useEffect(() => {
    const command = "sign-transaction";
    const totalPieces = lumenSignerTxData.length;
    setTransactionPart(
      `p${currentIndex + 1}of${totalPieces};${command};${
        lumenSignerTxData[currentIndex]
      }`,
    );
  }, [currentIndex, lumenSignerTxData]);

  const handleSend = (type: AuthType | undefined) => {
    if (type === AuthType.LUMENSIGNER) {
      dispatch(updateSendTxStatus(ActionStatus.PENDING));
      const path = `m/${lumenSignerSettings.bipPath}`;
      const networkPassphrase: string = settings.isTestnet
        ? Networks.TESTNET
        : Networks.PUBLIC;

      const transactionXdr = formData.tx?.toXDR().toString();
      const dataPieceLength = 80;
      const txData = `${path};${transactionXdr};${networkPassphrase}`;
      const dataPieces = Array.from(
        { length: Math.ceil(txData.length / dataPieceLength) },
        (_, i) => txData.slice(i * dataPieceLength, (i + 1) * dataPieceLength),
      );
      setLumenSignerTxData((_) => [...dataPieces]);
    } else {
      dispatch(sendTxAction(formData.tx));
    }
    logEvent("send: confirmed transaction", {
      amount: formData.amount.toString(),
      "used federation address": !!formData.federationAddress,
      "used memo": !!formData.memoContent,
    });
  };

  const goToReadSignature = () => {
    setInReadSignatureProcess(true);
  };

  const handleLumenSignerSubmitTx = (result: Result) => {
    const transaction = formData.tx;
    if (!transaction) {
      return;
    }
    if (!accountId) {
      return;
    }
    const qrData = result.getText();
    const isValidData = qrData.match("^signature;(.+)$");
    if (!isValidData) {
      return;
    }
    const qrDataArr = qrData.split(";");
    const signature = qrDataArr[1];

    transaction.addSignature(accountId, signature);
    dispatch(sendTxAction(transaction));
  };

  const getInstructionsMessage = (type: AuthType) => {
    switch (type) {
      case AuthType.ALBEDO:
        return "Review the transaction on the Albedo popup.";
      case AuthType.LEDGER:
        return "Review the transaction on your Ledger wallet device.";
      case AuthType.FREIGHTER:
        return "Review the transaction on the Freighter popup.";
      case AuthType.TREZOR:
        return "Follow the instructions on the Trezor popup.";
      default:
        return "Follow the instructions in the popup.";
    }
  };

  return (
    <>
      {settings.authType === AuthType.LUMENSIGNER &&
        status === ActionStatus.PENDING &&
        !inReadSignatureProcess && (
          <>
            <Modal.Heading>Confirm transaction</Modal.Heading>

            <InfoBlock>
              <p>
                Please use your LumenSigner to scan the QR code below until it
                enters the signing page.
              </p>
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
                  value={transactionPart}
                />
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button onClick={goToReadSignature}>Continue</Button>
            </Modal.Footer>
          </>
        )}

      {settings.authType === AuthType.LUMENSIGNER &&
        status === ActionStatus.PENDING &&
        inReadSignatureProcess && (
          <>
            <Modal.Heading>Confirm transaction</Modal.Heading>

            <InfoBlock>
              <p>
                After you authorize on LumenSigner, a QR code will appear on the
                screen of LumenSigner. Please hold it up to your device's
                camera.
              </p>
            </InfoBlock>

            <Modal.Body>
              <QrReader
                onResult={(result) => {
                  if (result) {
                    handleLumenSignerSubmitTx(result);
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
            </Modal.Body>
          </>
        )}

      {!(
        settings.authType === AuthType.LUMENSIGNER &&
        status === ActionStatus.PENDING
      ) && (
        <>
          <Modal.Heading>Confirm transaction</Modal.Heading>

          <Modal.Body>
            <LabelAndValue label="Sending to address">
              <Identicon publicAddress={formData.toAccountId} />
            </LabelAndValue>

            {formData.isAccountUnsafe && <AccountIsUnsafe />}

            <LabelAndValue label="Amount">
              {formData.amount}{" "}
              {new BigNumber(formData.amount).eq(1) ? "lumen" : "lumens"}
            </LabelAndValue>

            {formData.memoContent ? (
              <LabelAndValue label="Memo">
                {formData.memoContent} ({getMemoTypeText(formData.memoType)})
              </LabelAndValue>
            ) : null}

            <LabelAndValue label="Fee">{maxFee} lumens</LabelAndValue>

            {!formData.isAccountFunded && (
              <InfoBlock>
                The destination account doesn’t exist. A create account
                operation will be used to create this account.{" "}
                <TextLink href="https://developers.stellar.org/docs/tutorials/create-account/">
                  Learn more about account creation
                </TextLink>
              </InfoBlock>
            )}

            {status === ActionStatus.PENDING &&
              settings.authType &&
              settings.authType !== AuthType.PRIVATE_KEY && (
                <InfoBlock>
                  {getInstructionsMessage(settings.authType)}
                </InfoBlock>
              )}
          </Modal.Body>

          <Modal.Footer>
            <Button
              onClick={() => handleSend(settings.authType)}
              iconLeft={<Icon.Send />}
              isLoading={status === ActionStatus.PENDING}
            >
              Submit transaction
            </Button>
            <Button
              onClick={onBack}
              variant={Button.variant.secondary}
              disabled={status === ActionStatus.PENDING}
            >
              Back
            </Button>
          </Modal.Footer>

          {status === ActionStatus.PENDING && (
            <p className="Paragraph--secondary align--right">
              Submitting transaction
            </p>
          )}
        </>
      )}
    </>
  );
};
