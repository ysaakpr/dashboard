/* Copyright (c) 2022, VRAI Labs and/or its affiliates. All rights reserved.
 *
 * This software is licensed under the Apache License, Version 2.0 (the
 * "License") as published by the Apache Software Foundation.
 *
 * You may not use this file except in compliance with the License. You may
 * obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

import React, { MutableRefObject, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { deleteUser as deleteUserApi } from "../../../api/user/delete";
import { updateUserEmailVerificationStatus } from "../../../api/user/email/verify";
import { sendUserEmailVerification as sendUserEmailVerificationApi } from "../../../api/user/email/verify/token";
import fetchUsers from "../../../api/users";
import fetchCount from "../../../api/users/count";
import AuthWrapper from "../../components/authWrapper";
import { Footer, LOGO_ICON_LIGHT } from "../../components/footer/footer";
import InfoConnection from "../../components/info-connection/info-connection";
import NoUsers from "../../components/noUsers/NoUsers";
import UserDetail from "../../components/userDetail/userDetail";
import {
	getDeleteUserToast,
	getEmailUnVerifiedToast,
	getEmailVerifiedToast,
	getSendEmailVerificationToast,
} from "../../components/userDetail/userDetailForm";
import UsersListTable, {
	LIST_DEFAULT_LIMIT,
	OnSelectUserFunction,
	UserRowActionProps,
} from "../../components/usersListTable/UsersListTable";
import { PopupContentContext } from "../../contexts/PopupContentContext";
import { EmailVerificationStatus, UserWithRecipeId } from "./types";
import "./UsersList.scss";

type UserListPropsReloadRef = MutableRefObject<(() => Promise<void>) | undefined>;

type UserListProps = {
	onSelect: OnSelectUserFunction;
	css?: React.CSSProperties;
	/**
	 * a callback that can be used to trigger reloading the current active page
	 */
	reloadRef?: UserListPropsReloadRef;
} & UserRowActionProps;

type NextPaginationTokenByOffset = Record<number, string | undefined>;

export const UsersList: React.FC<UserListProps> = ({
	onSelect,
	css,
	reloadRef,
	onChangePasswordCallback,
	onDeleteCallback,
}) => {
	const limit = LIST_DEFAULT_LIMIT;
	const [count, setCount] = useState<number>();
	const [users, setUsers] = useState<UserWithRecipeId[]>([]);
	const [offset, setOffset] = useState<number>(0);
	const [loading, setLoading] = useState<boolean>(true);
	const [errorOffsets, setErrorOffsets] = useState<number[]>([]);
	const [connectionURI, setConnectionURI] = useState<string>();
	const [paginationTokenByOffset, setPaginationTokenByOffset] = useState<NextPaginationTokenByOffset>({});

	const insertUsersAtOffset = useCallback(
		(paramUsers: UserWithRecipeId[], paramOffset?: number) => {
			if (paramOffset === undefined) {
				return [...users, ...paramUsers];
			}
			return [...users.slice(0, paramOffset), ...paramUsers, ...users.slice(paramOffset + limit)];
		},
		[users, limit]
	);

	const getOffsetByPaginationToken = useCallback(
		(paginationToken?: string) => {
			if (paginationToken === undefined) {
				return 0;
			}
			const matchedPaginationTokenByOffsetPair = Object.entries(paginationTokenByOffset).find(
				([_, token]) => paginationToken === token
			);
			return matchedPaginationTokenByOffsetPair !== undefined
				? parseInt(matchedPaginationTokenByOffsetPair[0])
				: undefined;
		},
		[paginationTokenByOffset]
	);

	const loadUsers = useCallback(
		async (paginationToken?: string) => {
			const paramOffset = getOffsetByPaginationToken(paginationToken) ?? offset;
			setLoading(true);
			const nextOffset = paramOffset + limit;

			const data = await (paginationToken ? fetchUsers({ paginationToken }) : fetchUsers()).catch(
				() => undefined
			);
			if (data) {
				// store the users and pagination token
				const { users: responseUsers, nextPaginationToken } = data;
				setUsers(insertUsersAtOffset(responseUsers, paramOffset));
				setPaginationTokenByOffset({ ...paginationTokenByOffset, [nextOffset]: nextPaginationToken });
				setErrorOffsets(errorOffsets.filter((item) => item !== nextOffset));
			} else {
				setErrorOffsets([paramOffset]);
			}
			setLoading(false);
			setOffset(paramOffset);
		},
		[offset, errorOffsets, limit, paginationTokenByOffset, insertUsersAtOffset, getOffsetByPaginationToken]
	);

	const loadCount = useCallback(async () => {
		setLoading(true);
		const [countResult] = await Promise.all([fetchCount().catch(() => undefined), loadUsers()]);
		if (countResult) {
			setCount(countResult.count);
		}
		setLoading(false);
	}, []);

	const loadOffset = useCallback(
		async (offset: number) => {
			await loadUsers(paginationTokenByOffset[offset]);
		},
		[paginationTokenByOffset, loadUsers]
	);

	useEffect(() => {
		void loadCount();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		setConnectionURI((window as any).connectionURI);
	}, [loadCount]);

	useEffect(() => {
		if (reloadRef !== undefined) {
			reloadRef.current = () => loadOffset(offset);
		}
	}, [reloadRef, loadOffset, offset]);

	const onEmailChanged = async () => {
		await loadOffset(offset);
	};

	return (
		<div
			className="users-list"
			style={css}>
			<img
				className="title-image"
				src={LOGO_ICON_LIGHT}
				alt="Auth Page"
			/>
			<h1 className="users-list-title">User Management</h1>
			<p className="text-small users-list-subtitle">
				One place to manage all your users, revoke access and edit information according to your needs.
			</p>

			{connectionURI && <InfoConnection connectionURI={connectionURI} />}

			<div className="users-list-paper">
				{users.length === 0 && !loading && !errorOffsets.includes(0) ? (
					<NoUsers />
				) : (
					<UsersListTable
						users={users}
						offset={offset}
						count={count ?? 0}
						errorOffsets={errorOffsets}
						limit={limit}
						nextPaginationToken={paginationTokenByOffset[offset + limit]}
						goToNext={(token) => loadUsers(token)}
						offsetChange={loadOffset}
						isLoading={loading}
						onSelect={onSelect}
						onChangePasswordCallback={onChangePasswordCallback}
						onDeleteCallback={onDeleteCallback}
						onEmailChanged={onEmailChanged}
					/>
				)}
			</div>
		</div>
	);
};

export const UserListPage = () => {
	const navigate = useNavigate();
	const currentLocation = useLocation();
	const [selectedUser, setSelectedUser] = useState<string>();
	const [selectedRecipeId, setSelectedRecipeId] = useState<string>();
	const [selectedUserEmailVerification, setSelectedUserEmailVerification] = useState<
		EmailVerificationStatus | undefined
	>();
	const isSelectedUserNotEmpty = selectedUser !== undefined;

	const reloadListRef: UserListPropsReloadRef = useRef();

	const { showToast } = useContext(PopupContentContext);

	const backToList = useCallback(() => {
		navigate(
			{
				pathname: currentLocation.pathname,
				search: "",
			},
			{
				replace: true,
			}
		);
		void reloadListRef.current?.();
		setSelectedUser(undefined);
	}, []);

	const deleteUser = useCallback(
		async (userId: string) => {
			const deleteSucceed = await deleteUserApi(userId);
			const didSucceed = deleteSucceed !== undefined && deleteSucceed.status === "OK";
			if (didSucceed) {
				backToList();
			}
			showToast(getDeleteUserToast(didSucceed));
		},
		[backToList, showToast]
	);

	const changePassword = useCallback(
		async (userId: string, newPassword: string) => {
			// const response = await updatePassword(userId, newPassword);
			// showToast(getUpdatePasswordToast(respo));
		},
		[showToast]
	);

	const sendUserEmailVerification = useCallback(
		async (userId: string) => {
			const isSend = await sendUserEmailVerificationApi(userId);
			showToast(getSendEmailVerificationToast(isSend));
			return isSend;
		},
		[showToast]
	);

	const updateEmailVerificationStatus = useCallback(
		async (userId: string, isVerified: boolean) => {
			const isUpdated = await updateUserEmailVerificationStatus(userId, isVerified);
			if (isUpdated) {
				setSelectedUserEmailVerification({ isVerified, status: "OK" });
			}
			showToast(isVerified ? getEmailVerifiedToast(isUpdated) : getEmailUnVerifiedToast(isUpdated));
			return isUpdated;
		},
		[showToast]
	);

	// load user detail && email verification from API when userId changes
	// useEffect(() => {
	// 	if (selectedUser !== undefined) {
	// 		void getUser(selectedUser);
	// 		if (isEmailVerificationApplicable(selectedUser.recipeId)) {
	// 			void getUserEmailVerificationStatus(selectedUser?.user.id).then(setSelectedUserEmailVerification);
	// 		}
	// 	} else {
	// 		setSelectedUserEmailVerification(undefined);
	// 	}
	// }, [selectedUser?.user.id, selectedUser?.recipeId, getUser]);

	useEffect(() => {
		if (selectedUser === undefined && currentLocation.search !== null && currentLocation.search !== "") {
			const urlParams = new URLSearchParams(currentLocation.search);
			const userid = urlParams.get("userid");
			const recipeId = urlParams.get("recipeId");

			if (userid !== null && recipeId !== null) {
				// This means that there is a userid in the URL, show details
				setSelectedUser(userid);
				setSelectedRecipeId(recipeId);
			}
		}
	}, []);

	const onUserSelected = (user: UserWithRecipeId) => {
		navigate(
			{
				pathname: currentLocation.pathname,
				search: `?userid=${user.user.id}&recipeId=${user.recipeId}`,
			},
			{
				replace: true,
			}
		);
		setSelectedUser(user.user.id);
		setSelectedRecipeId(user.recipeId);
	};

	return (
		<AuthWrapper>
			{isSelectedUserNotEmpty && selectedRecipeId !== undefined && (
				<UserDetail
					recipeId={selectedRecipeId}
					user={selectedUser}
					onBackButtonClicked={backToList}
					onDeleteCallback={({ user: { id } }) => deleteUser(id)}
					onSendEmailVerificationCallback={({ user: { id } }) => sendUserEmailVerification(id)}
					onUpdateEmailVerificationStatusCallback={updateEmailVerificationStatus}
					onChangePasswordCallback={changePassword}
				/>
			)}
			<UsersList
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				onSelect={onUserSelected}
				css={isSelectedUserNotEmpty ? { display: "none" } : undefined}
				reloadRef={reloadListRef}
				onChangePasswordCallback={changePassword}
				onDeleteCallback={({ user: { id } }) => deleteUser(id)}
			/>
			<Footer
				colorMode="dark"
				horizontalAlignment="center"
				verticalAlignment="center"
			/>
		</AuthWrapper>
	);
};

export default UserListPage;
