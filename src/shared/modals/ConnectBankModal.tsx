import { Modal, Button, Alert, Nav, Tab, Form, InputGroup } from 'react-bootstrap';
import { useState } from 'react';
import { Formik, Field, Form as FormikForm, ErrorMessage } from 'formik';
import * as Yup from 'yup';

interface ConnectBankModalProps {
  show: boolean;
  handleClose: () => void;
}

interface CustomAccountFormValues {
  bankName: string;
  accountType: string;
  accountNumber: string;
  initialBalance: number;
}

const ConnectBankModal: React.FC<ConnectBankModalProps> = ({ show, handleClose }) => {
  const [key, setKey] = useState<string>('mock');
  const [showMockAlert, setShowMockAlert] = useState<boolean>(false); // <-- added state

  const initialValues: CustomAccountFormValues = {
    bankName: '',
    accountType: '',
    accountNumber: '',
    initialBalance: 0,
  };

  const validationSchema = Yup.object({
    bankName: Yup.string().required('Bank name is required'),
    accountType: Yup.string().required('Account type is required'),
    accountNumber: Yup.string()
      .matches(/^\d{4}$/, 'Enter exactly 4 digits')
      .required('Account number is required'),
    initialBalance: Yup.number()
      .min(0, 'Balance cannot be negative')
      .required('Initial balance is required'),
  });

  const handleSubmit = (values: CustomAccountFormValues) => {
    console.log('Custom account submitted:', values);
    handleClose();
  };

  const handleMockConnection = () => {
    setShowMockAlert(true); // <-- show alert
    setTimeout(() => {
      setShowMockAlert(false); // hide after 3 seconds
      handleClose(); // optionally close modal
    }, 3000);
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="lg"
    >
      <Modal.Header closeButton>
        <Modal.Title>Connect Your Bank</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info">
          <i className="fas fa-info-circle me-2"></i>
          You&apos;re in development mode. You can create mock data or add a custom bank account.
        </Alert>

        <Tab.Container
          activeKey={key}
          onSelect={(k) => setKey(k ?? 'mock')}
        >
          <Nav
            variant="tabs"
            className="mb-3"
          >
            <Nav.Item>
              <Nav.Link eventKey="mock">Mock Connection</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="custom">Add Custom Account</Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content>
            <Tab.Pane eventKey="mock">
              {showMockAlert && (
                <Alert
                  variant="success"
                  onClose={() => setShowMockAlert(false)}
                  dismissible
                >
                  Mock connection completed successfully!
                </Alert>
              )}

              <p>Would you like to connect to your bank account and import mock transactions?</p>
              <Button
                variant="primary"
                className="w-100"
                onClick={handleMockConnection}
              >
                <i className="fas fa-check me-2"></i>Complete Mock Connection
              </Button>
            </Tab.Pane>

            <Tab.Pane eventKey="custom">
              <Formik
                initialValues={initialValues}
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
              >
                {({ errors, touched }) => (
                  <FormikForm>
                    <Form.Group className="mb-3">
                      <Form.Label>Bank Name</Form.Label>
                      <Field
                        name="bankName"
                        as={Form.Control}
                        isInvalid={touched.bankName && !!errors.bankName}
                      />
                      <Form.Control.Feedback type="invalid">
                        <ErrorMessage name="bankName" />
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Account Type</Form.Label>
                      <Field
                        name="accountType"
                        as={Form.Select}
                        isInvalid={touched.accountType && !!errors.accountType}
                      >
                        <option value="">Select account type</option>
                        <option value="checking">Checking Account</option>
                        <option value="savings">Savings Account</option>
                        <option value="credit">Credit Card</option>
                        <option value="investment">Investment Account</option>
                      </Field>
                      <Form.Control.Feedback type="invalid">
                        <ErrorMessage name="accountType" />
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Account Number (last 4 digits)</Form.Label>
                      <Field
                        name="accountNumber"
                        as={Form.Control}
                        maxLength={4}
                        isInvalid={touched.accountNumber && !!errors.accountNumber}
                      />
                      <Form.Text>For demo purposes only, enter any 4 digits</Form.Text>
                      <Form.Control.Feedback type="invalid">
                        <ErrorMessage name="accountNumber" />
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Initial Balance</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>$</InputGroup.Text>
                        <Field
                          name="initialBalance"
                          type="number"
                          as={Form.Control}
                          min={0}
                          step="0.01"
                          isInvalid={touched.initialBalance && !!errors.initialBalance}
                        />
                      </InputGroup>
                      <Form.Control.Feedback type="invalid">
                        <ErrorMessage name="initialBalance" />
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Button
                      variant="primary"
                      type="submit"
                      className="w-100"
                    >
                      <i className="fas fa-plus me-2"></i>Add Custom Account
                    </Button>
                  </FormikForm>
                )}
              </Formik>
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={handleClose}
        >
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConnectBankModal;
