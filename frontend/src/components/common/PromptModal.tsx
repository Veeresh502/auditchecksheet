import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

interface PromptModalProps {
    show: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    title: string;
    label: string;
    initialValue?: string;
    confirmText?: string;
}

const PromptModal: React.FC<PromptModalProps> = ({
    show,
    onClose,
    onSubmit,
    title,
    label,
    initialValue = '',
    confirmText = 'Submit',
}) => {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (show) {
            setValue(initialValue);
        }
    }, [show, initialValue]);

    const handleSubmit = () => {
        onSubmit(value);
        onClose();
    };

    return (
        <Modal show={show} onHide={onClose} centered backdrop="static">
            <Modal.Header closeButton>
                <Modal.Title>{title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form.Group>
                    <Form.Label>{label}</Form.Label>
                    <Form.Control
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        autoFocus
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={handleSubmit} disabled={!value.trim()}>
                    {confirmText}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default PromptModal;
